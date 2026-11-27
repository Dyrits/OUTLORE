import { describe, expect, it } from "@effect/vitest";
import { harnessNames } from "@outlore/contracts";
import { Deferred, Effect, Fiber, Record } from "effect";
import { type HarnessAdapter, routeHarnesses, runKeyOf } from "../../src/core/index.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

/** An adapter whose turn of each run holds until that run is released, recording the keys steering and interrupts went to. */
const recordingAdapter = () => {
  const interrupted: Array<string> = [];
  const steered: Array<string> = [];
  const releases = new Map<string, Deferred.Deferred<void>>();
  const releaseOf = (runKey: string) => {
    const existing = releases.get(runKey);
    if (existing !== undefined) return existing;
    const created = Deferred.makeUnsafe<void>();
    releases.set(runKey, created);
    return created;
  };
  const adapter = {
    interrupt: (runKey) => Effect.sync(() => interrupted.push(runKey) > 0),
    readPlanLimits: () => Effect.succeed(null),
    runTurn: (request) =>
      Deferred.await(releaseOf(runKeyOf(request))).pipe(
        Effect.as({ billing: "Unknown", cost: null, isInterrupted: false, sessionId: "session", usage: null }),
      ),
    steer: (runKey) => Effect.sync(() => steered.push(runKey) > 0),
  } satisfies HarnessAdapter;
  return { adapter, interrupted, release: (runKey: string) => Deferred.succeed(releaseOf(runKey), void 0), steered };
};

const sideKey = "thread-1#companion";

describe("routing steering and interrupts to the run that holds a turn", () => {
  it.live("keeps the main run's route when a run beside it ends, and drops only the ended run's", () =>
    Effect.gen(function* () {
      const recording = recordingAdapter();
      const router = routeHarnesses(Record.fromEntries(harnessNames.map((name) => [name, recording.adapter])));
      const mainTurn = yield* Effect.forkChild(router.runTurn(turnRequestOf({ threadId: "thread-1" })));
      const sideTurn = yield* Effect.forkChild(
        router.runTurn(turnRequestOf({ runKey: sideKey, threadId: "thread-1" })),
      );
      yield* Effect.yieldNow;
      expect(yield* router.interrupt(sideKey)).toBe(true);
      expect(yield* router.steer("thread-1", { id: "m1", images: [], text: "More" })).toBe(true);

      yield* recording.release(sideKey);
      yield* Fiber.join(sideTurn);

      expect(yield* router.steer(sideKey, { id: "m2", images: [], text: "Late" })).toBe(false);
      expect(yield* router.interrupt(sideKey)).toBe(false);
      expect(yield* router.interrupt("thread-1")).toBe(true);
      expect(recording.interrupted).toEqual([sideKey, "thread-1"]);
      expect(recording.steered).toEqual(["thread-1"]);
      yield* recording.release("thread-1");
      yield* Fiber.join(mainTurn);
    }),
  );

  it.live("routes a request with no run key by its thread id, as the main run", () =>
    Effect.gen(function* () {
      const recording = recordingAdapter();
      const router = routeHarnesses(Record.fromEntries(harnessNames.map((name) => [name, recording.adapter])));
      const turn = yield* Effect.forkChild(router.runTurn(turnRequestOf({ threadId: "thread-1" })));
      yield* Effect.yieldNow;
      expect(yield* router.interrupt("thread-1")).toBe(true);
      yield* recording.release("thread-1");
      yield* Fiber.join(turn);
      expect(yield* router.interrupt("thread-1")).toBe(false);
    }),
  );
});
