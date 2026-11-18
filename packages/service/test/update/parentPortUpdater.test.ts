import { describe, expect, it } from "@effect/vitest";
import type { UpdaterCall, UpdaterReply } from "@outlore/contracts";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { HostUpdater } from "../../src/update/index.ts";
import { parentPortUpdaterLayer } from "../../src/update/parentPortUpdater.ts";

// The service reaches the desktop app's updater through the utility process's parent port: calls carry an
// identifier and the main process answers each on it (app-updates, Updating a host from a paired device).

/** A stand-in for the parent port: it records what the service posted and lets the test answer. */
const fakePort = () => {
  const posted: UpdaterCall[] = [];
  let listener: ((message: unknown) => void) | null = null;
  return {
    answer: (reply: Omit<UpdaterReply, "type">) => listener?.({ ...reply, type: "updaterReply" }),
    deliver: (message: unknown) => listener?.(message),
    port: {
      onMessage: (next: (message: unknown) => void) => {
        listener = next;
      },
      postMessage: (message: unknown) => posted.push(message as UpdaterCall),
    },
    posted,
  };
};

const settle = Effect.gen(function* () {
  for (let index = 0; index < 20; index++) yield* Effect.yieldNow;
});

describe("the updater reached through the parent port", () => {
  it.effect("asks the main process for the state and returns its answer", () =>
    Effect.gen(function* () {
      const fake = fakePort();
      const updater = yield* HostUpdater.pipe(Effect.provide(parentPortUpdaterLayer(fake.port)));
      const asked = yield* Effect.forkChild(updater.state);
      yield* settle;
      expect(fake.posted).toMatchObject([{ call: "state", type: "updater" }]);
      fake.answer({
        error: null,
        id: fake.posted[0]?.id ?? "",
        status: { _tag: "Ready", version: "0.1.10-Prototype" },
      });
      expect(yield* Fiber.join(asked)).toMatchObject({ _tag: "Ready" });
    }),
  );

  it.effect("returns the answer of each call on its own identifier", () =>
    Effect.gen(function* () {
      const fake = fakePort();
      const updater = yield* HostUpdater.pipe(Effect.provide(parentPortUpdaterLayer(fake.port)));
      const first = yield* Effect.forkChild(updater.state);
      const second = yield* Effect.forkChild(updater.check);
      yield* settle;
      const [stateCall, checkCall] = [
        fake.posted.find((call) => call.call === "state"),
        fake.posted.find((call) => call.call === "check"),
      ];
      fake.answer({ error: null, id: checkCall?.id ?? "", status: { _tag: "Idle", note: "up to date" } });
      fake.answer({ error: null, id: stateCall?.id ?? "", status: { _tag: "Checking" } });
      expect(yield* Fiber.join(first)).toMatchObject({ _tag: "Checking" });
      expect(yield* Fiber.join(second)).toMatchObject({ _tag: "Idle", note: "up to date" });
    }),
  );

  it.effect("says the state is unsupported when the main process does not answer", () =>
    Effect.gen(function* () {
      const fake = fakePort();
      const updater = yield* HostUpdater.pipe(Effect.provide(parentPortUpdaterLayer(fake.port)));
      const asked = yield* Effect.forkChild(updater.state);
      yield* settle;
      yield* TestClock.adjust("10 seconds");
      expect(yield* Fiber.join(asked)).toMatchObject({ _tag: "Unsupported" });
    }),
  );

  it.effect("takes an install with no answer as the host going away", () =>
    Effect.gen(function* () {
      const fake = fakePort();
      const updater = yield* HostUpdater.pipe(Effect.provide(parentPortUpdaterLayer(fake.port)));
      const asked = yield* Effect.forkChild(updater.install);
      yield* settle;
      expect(fake.posted).toMatchObject([{ call: "install" }]);
      yield* TestClock.adjust("10 seconds");
      expect(yield* Fiber.join(asked)).toMatchObject({ failure: null });
    }),
  );

  it.effect("returns an install the main process refused as its failure", () =>
    Effect.gen(function* () {
      const fake = fakePort();
      const updater = yield* HostUpdater.pipe(Effect.provide(parentPortUpdaterLayer(fake.port)));
      const asked = yield* Effect.forkChild(updater.install);
      yield* settle;
      fake.answer({ error: "There is no update ready to install.", id: fake.posted[0]?.id ?? "", status: null });
      expect(yield* Fiber.join(asked)).toMatchObject({ failure: "There is no update ready to install." });
    }),
  );

  it.effect("ignores a message that is not an answer to a call", () =>
    Effect.gen(function* () {
      const fake = fakePort();
      const updater = yield* HostUpdater.pipe(Effect.provide(parentPortUpdaterLayer(fake.port)));
      const asked = yield* Effect.forkChild(updater.state);
      yield* settle;
      fake.deliver({ type: "ready" });
      fake.answer({ error: null, id: "someone-else", status: { _tag: "Checking" } });
      yield* settle;
      expect(fake.posted).toHaveLength(1);
      fake.answer({ error: null, id: fake.posted[0]?.id ?? "", status: { _tag: "Idle", note: null } });
      expect(yield* Fiber.join(asked)).toMatchObject({ _tag: "Idle" });
    }),
  );
});
