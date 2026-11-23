import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { UpdaterStatus } from "@outlore/contracts";
import { Effect, Layer, Ref } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { fakeHarnessLayer, Service, serviceLayer } from "../../src/index.ts";
import { HostUpdater } from "../../src/update/index.ts";
import { temporary } from "../fixtures/service.ts";

// Updating a host from a paired device: the host arms an install and runs it once no turn is running (app-updates).

/** A stand-in for the desktop app's updater: its status is whatever the test sets, and it counts what it was asked. */
const fakeUpdater = (initial: UpdaterStatus, afterCheck: UpdaterStatus) => {
  const status = Ref.makeUnsafe<UpdaterStatus>(initial);
  const calls = { checks: 0, installs: 0 };
  const installFailure: { message: string | null } = { message: null };
  const layer = Layer.succeed(HostUpdater, {
    check: Effect.gen(function* () {
      calls.checks++;
      yield* Ref.set(status, { _tag: "Checking" });
      yield* Effect.sleep("3 seconds");
      yield* Ref.set(status, afterCheck);
      return afterCheck;
    }),
    install: Effect.sync(() => {
      calls.installs++;
      return { failure: installFailure.message };
    }),
    state: Ref.get(status),
  });
  return { calls, installFailure, layer, status };
};

const host = (updater: Layer.Layer<HostUpdater>) => {
  const directory = temporary("outlore-host-update-");
  return serviceLayer({
    filename: join(directory, "store.sqlite"),
    harness: fakeHarnessLayer("10 millis"),
    homeFolder: directory,
    hostUpdater: updater,
    release: "0.1.9-Prototype",
    scratchRoot: join(directory, "missions"),
  });
};

const advance = (seconds: number) =>
  Effect.gen(function* () {
    for (let second = 0; second < seconds; second++) {
      yield* TestClock.adjust("1 second");
      for (let index = 0; index < 20; index++) yield* Effect.yieldNow;
    }
  });

const ask = (tag: "ReadHostUpdate" | "UpdateHost" | "ForceUpdateHost") =>
  Effect.gen(function* () {
    return yield* (yield* Service).handle({ _tag: tag });
  });

/** Writes a running turn on a quest, as a harness would while it works. */
const startRunningTurn = (turnId: string) =>
  Effect.gen(function* () {
    const service = yield* Service;
    const quest = (yield* service.handle({ _tag: "StartEmptyQuest", realmId: null, requestId: `quest-${turnId}` })) as {
      threadId: string;
    };
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO turns (id, thread_id, status, started_at) VALUES (${turnId}, ${quest.threadId}, 'running', 1)`;
  });

const endTurn = (turnId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE turns SET status = 'completed', ended_at = 2 WHERE id = ${turnId}`;
  });

describe("updating the host from a paired device", () => {
  it.effect("reports the host's release and that the host cannot update when it has no updater", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater(
        { _tag: "Unsupported", reason: "Updates apply to the installed app." },
        { _tag: "Idle", note: null },
      );
      const read = yield* ask("ReadHostUpdate").pipe(Effect.provide(host(fake.layer)));
      expect(read).toEqual({
        release: "0.1.9-Prototype",
        status: { _tag: "Unsupported", reason: "Updates apply to the installed app." },
      });
      const updated = yield* ask("UpdateHost").pipe(Effect.provide(host(fake.layer)));
      expect(updated).toMatchObject({ status: { _tag: "Unsupported" } });
      expect(fake.calls).toEqual({ checks: 0, installs: 0 });
    }),
  );

  it.effect("says it is unsupported by default, as a development run of the service is", () =>
    Effect.gen(function* () {
      const directory = temporary("outlore-host-update-");
      const layer = serviceLayer({
        filename: join(directory, "store.sqlite"),
        harness: fakeHarnessLayer("10 millis"),
        homeFolder: directory,
        scratchRoot: join(directory, "missions"),
      });
      const read = yield* ask("ReadHostUpdate").pipe(Effect.provide(layer));
      expect(read).toMatchObject({ release: "development", status: { _tag: "Unsupported" } });
    }),
  );

  it.effect("checks, waits for running turns to finish, then installs once", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater({ _tag: "Idle", note: null }, { _tag: "Ready", version: "0.1.10-Prototype" });
      yield* Effect.gen(function* () {
        yield* startRunningTurn("turn-a");
        yield* startRunningTurn("turn-b");
        const started = yield* ask("UpdateHost");
        expect(started).toMatchObject({ status: { _tag: "Checking" } });
        yield* advance(4);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({
          status: { _tag: "WaitingForTurns", runningCount: 2, version: "0.1.10-Prototype" },
        });
        yield* endTurn("turn-a");
        yield* advance(5);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({ status: { _tag: "WaitingForTurns", runningCount: 1 } });
        expect(fake.calls.installs).toBe(0);
        yield* endTurn("turn-b");
        yield* advance(5);
        expect(fake.calls.installs).toBe(1);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({
          status: { _tag: "Installing", version: "0.1.10-Prototype" },
        });
        yield* advance(30);
        expect(fake.calls.installs).toBe(1);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );

  it.effect("installs at once when nothing is running, and asking again changes nothing", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater(
        { _tag: "Ready", version: "0.1.10-Prototype" },
        { _tag: "Ready", version: "0.1.10-Prototype" },
      );
      yield* Effect.gen(function* () {
        yield* ask("UpdateHost");
        yield* ask("UpdateHost");
        yield* advance(6);
        yield* ask("UpdateHost");
        yield* advance(6);
        expect(fake.calls.installs).toBe(1);
        expect(fake.calls.checks).toBe(0);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );

  it.effect("installs nothing when no newer release is found", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater({ _tag: "Idle", note: null }, { _tag: "Idle", note: "Outlore is up to date." });
      yield* Effect.gen(function* () {
        yield* ask("UpdateHost");
        yield* advance(10);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({
          status: { _tag: "Idle", note: "Outlore is up to date." },
        });
        expect(fake.calls.installs).toBe(0);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );

  it.effect("reports a failed install and lets the owner try again", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater(
        { _tag: "Ready", version: "0.1.10-Prototype" },
        { _tag: "Ready", version: "0.1.10-Prototype" },
      );
      fake.installFailure.message = "Outlore cannot write its folder.";
      yield* Effect.gen(function* () {
        yield* ask("UpdateHost");
        yield* advance(6);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({
          status: { _tag: "Failed", message: "Outlore cannot write its folder." },
        });
        fake.installFailure.message = null;
        yield* ask("UpdateHost");
        yield* advance(6);
        expect(fake.calls.installs).toBe(2);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );

  it.effect("reports a check that failed and installs nothing", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater({ _tag: "Idle", note: null }, { _tag: "Failed", message: "GitHub did not answer." });
      yield* Effect.gen(function* () {
        yield* ask("UpdateHost");
        yield* advance(10);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({
          status: { _tag: "Failed", message: "GitHub did not answer." },
        });
        expect(fake.calls.installs).toBe(0);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );
});

describe("forcing the update over running turns", () => {
  it.effect("installs once without waiting for the running turns", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater({ _tag: "Idle", note: null }, { _tag: "Ready", version: "0.1.10-Prototype" });
      yield* Effect.gen(function* () {
        yield* startRunningTurn("turn-a");
        yield* startRunningTurn("turn-b");
        const started = yield* ask("ForceUpdateHost");
        expect(started).toMatchObject({ status: { _tag: "Checking" } });
        yield* advance(6);
        expect(fake.calls.installs).toBe(1);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({
          status: { _tag: "Installing", version: "0.1.10-Prototype" },
        });
        yield* advance(30);
        expect(fake.calls.installs).toBe(1);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );

  it.effect("lifts the wait of an update that is already armed, and a plain ask still waits", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater(
        { _tag: "Ready", version: "0.1.10-Prototype" },
        { _tag: "Ready", version: "0.1.10-Prototype" },
      );
      yield* Effect.gen(function* () {
        yield* startRunningTurn("turn-a");
        yield* ask("UpdateHost");
        yield* advance(6);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({ status: { _tag: "WaitingForTurns", runningCount: 1 } });
        yield* ask("UpdateHost");
        yield* advance(6);
        expect(fake.calls.installs).toBe(0);
        expect(yield* ask("ForceUpdateHost")).toMatchObject({ status: { _tag: "Installing" } });
        yield* advance(6);
        expect(fake.calls.installs).toBe(1);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );

  it.effect("changes nothing when asked a second time, or once the install runs", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater(
        { _tag: "Ready", version: "0.1.10-Prototype" },
        { _tag: "Ready", version: "0.1.10-Prototype" },
      );
      yield* Effect.gen(function* () {
        yield* startRunningTurn("turn-a");
        yield* ask("ForceUpdateHost");
        yield* ask("ForceUpdateHost");
        yield* advance(6);
        yield* ask("ForceUpdateHost");
        yield* ask("UpdateHost");
        yield* advance(6);
        expect(fake.calls.installs).toBe(1);
        expect(fake.calls.checks).toBe(0);
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );

  it.effect("forces nothing when the host cannot update itself", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater(
        { _tag: "Unsupported", reason: "Updates apply to the installed app." },
        { _tag: "Idle", note: null },
      );
      const forced = yield* Effect.gen(function* () {
        yield* startRunningTurn("turn-a");
        return yield* ask("ForceUpdateHost");
      }).pipe(Effect.provide(host(fake.layer)));
      expect(forced).toMatchObject({ status: { _tag: "Unsupported" } });
      expect(fake.calls).toEqual({ checks: 0, installs: 0 });
    }),
  );

  it.effect("forgets the force after a failed install: the next plain ask waits again", () =>
    Effect.gen(function* () {
      const fake = fakeUpdater(
        { _tag: "Ready", version: "0.1.10-Prototype" },
        { _tag: "Ready", version: "0.1.10-Prototype" },
      );
      fake.installFailure.message = "Outlore cannot write its folder.";
      yield* Effect.gen(function* () {
        yield* startRunningTurn("turn-a");
        yield* ask("ForceUpdateHost");
        yield* advance(6);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({ status: { _tag: "Failed" } });
        fake.installFailure.message = null;
        yield* ask("UpdateHost");
        yield* advance(6);
        expect(fake.calls.installs).toBe(1);
        expect(yield* ask("ReadHostUpdate")).toMatchObject({ status: { _tag: "WaitingForTurns", runningCount: 1 } });
      }).pipe(Effect.provide(host(fake.layer)));
    }),
  );
});
