import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { HarnessFailure, type TurnRequest } from "../../src/core/index.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type ProcessSignals,
} from "../../src/harness/harnessProcesses.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

type RunConnection = HarnessConnection & { isClosed: boolean; hasPendingWake: boolean };

const sideKey = "thread-1#companion";
const main = { threadId: "thread-1" } satisfies Partial<TurnRequest>;
const side = { runKey: sideKey, threadId: "thread-1" } satisfies Partial<TurnRequest>;

/** A fake protocol whose turns hold until released and whose started processes, with their signals, are kept for checks. */
const holdingProtocol = () => {
  const connections: Array<RunConnection> = [];
  const signals: Array<ProcessSignals> = [];
  const running = Deferred.makeUnsafe<void>();
  const release = Deferred.makeUnsafe<void>();
  const steered: Array<RunConnection> = [];
  const protocol: HarnessProtocol<RunConnection> = {
    interrupt: () => Effect.succeed(true),
    restartKeyOf: (request) => request.model,
    runTurn: () =>
      Deferred.succeed(running, void 0).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.as({ isInterrupted: false, usage: null }),
      ),
    start: (_request, startedSignals) =>
      Effect.sync(() => {
        const connection: RunConnection = {
          close: () => {
            connection.isClosed = true;
          },
          hasBackgroundWake: () => connection.hasPendingWake,
          hasExited: () => connection.isClosed,
          hasPendingWake: false,
          isClosed: false,
          sessionId: `session-${connections.length + 1}`,
        };
        connections.push(connection);
        signals.push(startedSignals);
        return connection;
      }),
    steer: (connection) => Effect.sync(() => steered.push(connection) > 0),
  };
  return { connections, protocol, release, running, signals, steered };
};

describe("a thread's runs in the harness pool", () => {
  it.live("keeps a process for each run of a thread and sends an interrupt by thread id to the main run only", () =>
    Effect.gen(function* () {
      const { connections, protocol, release, running, steered } = holdingProtocol();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes", interruptGrace: "20 millis" });
      const mainTurn = yield* Effect.forkChild(pool.runTurn(turnRequestOf(main)));
      yield* Deferred.await(running);
      const sideTurn = yield* Effect.forkChild(pool.runTurn(turnRequestOf(side)));
      while (connections.length < 2) yield* Effect.sleep("5 millis");
      expect(connections).toHaveLength(2);

      // Steering reaches the process of the run it is addressed to.
      expect(yield* pool.steer(sideKey, { id: "m1", images: [], text: "More" })).toBe(true);
      expect(steered).toEqual([connections[1]]);

      expect(yield* pool.interrupt("thread-1")).toBe(true);
      expect((yield* Fiber.join(mainTurn)).isInterrupted).toBe(true);
      // The main run's end closed its process and left the side run's running.
      expect(connections.map((connection) => connection.isClosed)).toEqual([true, false]);
      expect(yield* pool.interrupt("thread-1")).toBe(false);
      expect(yield* pool.steer("thread-1", { id: "m2", images: [], text: "Late" })).toBe(false);
      expect(yield* pool.steer(sideKey, { id: "m3", images: [], text: "Still there" })).toBe(true);

      yield* Deferred.succeed(release, void 0);
      expect((yield* Fiber.join(sideTurn)).isInterrupted).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.live("restarts a run's process on its own restart key without touching another run's", () =>
    Effect.gen(function* () {
      const { connections, protocol, release } = holdingProtocol();
      yield* Deferred.succeed(release, void 0);
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      yield* pool.runTurn(turnRequestOf({ ...main, model: "haiku" }));
      yield* pool.runTurn(turnRequestOf({ ...side, model: "opus" }));
      yield* pool.runTurn(turnRequestOf({ ...main, model: "haiku" }));
      yield* pool.runTurn(turnRequestOf({ ...side, model: "sonnet" }));
      expect(connections.map((connection) => connection.isClosed)).toEqual([false, true, false]);
    }).pipe(Effect.scoped),
  );

  it.live("cancels a side run interrupted while its process starts without cancelling the main run's turn", () =>
    Effect.gen(function* () {
      const { connections, protocol, release, running } = holdingProtocol();
      const starting = yield* Deferred.make<void>();
      const released = yield* Deferred.make<void>();
      const slow: HarnessProtocol<RunConnection> = {
        ...protocol,
        start: (request, signals) =>
          request.runKey === undefined
            ? protocol.start(request, signals)
            : Deferred.succeed(starting, void 0).pipe(
                Effect.andThen(Deferred.await(released)),
                Effect.andThen(protocol.start(request, signals)),
              ),
      };
      const pool = yield* makeHarnessProcesses(slow, { idleTimeout: "10 minutes" });
      const mainTurn = yield* Effect.forkChild(pool.runTurn(turnRequestOf(main)));
      yield* Deferred.await(running);
      const sideTurn = yield* Effect.forkChild(pool.runTurn(turnRequestOf(side)));
      yield* Deferred.await(starting);
      expect(yield* pool.interrupt(sideKey)).toBe(true);
      yield* Deferred.succeed(released, void 0);
      expect((yield* Fiber.join(sideTurn)).isInterrupted).toBe(true);
      yield* Deferred.succeed(release, void 0);
      expect((yield* Fiber.join(mainTurn)).isInterrupted).toBe(false);
      expect(connections).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.live("asks for a turn of the thread when a main run's process wakes itself, and never for a side run's", () =>
    Effect.gen(function* () {
      const { connections, protocol, release, signals } = holdingProtocol();
      yield* Deferred.succeed(release, void 0);
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const asked: Array<string> = [];
      pool.onBackgroundWake((threadId) => Effect.sync(() => asked.push(threadId) > 0));
      yield* pool.runTurn(turnRequestOf(side));
      yield* pool.runTurn(turnRequestOf(main));
      for (const connection of connections) connection.hasPendingWake = true;
      signals[0]?.resume();
      yield* Effect.yieldNow;
      expect(asked).toEqual([]);
      signals[1]?.resume();
      yield* Effect.yieldNow;
      expect(asked).toEqual(["thread-1"]);
    }).pipe(Effect.scoped),
  );

  it.live("reports a failure of one run without closing the other run's process", () =>
    Effect.gen(function* () {
      const { connections, protocol, release, running } = holdingProtocol();
      const failing: HarnessProtocol<RunConnection> = {
        ...protocol,
        runTurn: (connection, request, control) =>
          request.runKey === undefined
            ? protocol.runTurn(connection, request, control)
            : Effect.fail(new HarnessFailure({ reason: "The side run failed." })),
      };
      const pool = yield* makeHarnessProcesses(failing, { idleTimeout: "10 minutes" });
      const mainTurn = yield* Effect.forkChild(pool.runTurn(turnRequestOf(main)));
      yield* Deferred.await(running);
      const failure = yield* pool.runTurn(turnRequestOf(side)).pipe(Effect.flip);
      expect(failure.reason).toBe("The side run failed.");
      expect(connections.map((connection) => connection.isClosed)).toEqual([false, true]);
      yield* Deferred.succeed(release, void 0);
      expect((yield* Fiber.join(mainTurn)).isInterrupted).toBe(false);
    }).pipe(Effect.scoped),
  );
});
