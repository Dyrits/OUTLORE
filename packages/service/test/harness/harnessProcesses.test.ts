import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { vi } from "vitest";
import { HarnessFailure, type TurnRequest } from "../../src/core/index.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
  type ProcessSignals,
  type TurnEnd,
} from "../../src/harness/harnessProcesses.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

type FakeConnection = HarnessConnection & {
  isClosed: boolean;
};

/** A fake protocol in-process: each turn runs `behavior`, and every started process is kept for checks. */
const fakeProtocolOf = (
  behavior: (turn: PooledTurn, request: TurnRequest) => Effect.Effect<TurnEnd, HarnessFailure> = () =>
    Effect.succeed({ isInterrupted: false, usage: null }),
) => {
  const connections: Array<FakeConnection> = [];
  const protocol: HarnessProtocol<FakeConnection> = {
    interrupt: () => Effect.succeed(true),
    restartKeyOf: (request) => request.model,
    runTurn: (_connection, request, turn) => behavior(turn, request),
    start: () =>
      Effect.sync(() => {
        const connection: FakeConnection = {
          close: () => {
            connection.isClosed = true;
          },
          hasExited: () => connection.isClosed,
          isClosed: false,
          sessionId: `session-${connections.length + 1}`,
        };
        connections.push(connection);
        return connection;
      }),
    steer: () => Effect.succeed(true),
  };
  return { connections, protocol };
};

const usage = { cacheCreation: 0, cacheRead: 0, input: 5, output: 1 };

describe("keeping a thread's harness process", () => {
  it.live("reuses the process while the restart key holds", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      yield* pool.runTurn(turnRequestOf({ model: "haiku" }));
      yield* pool.runTurn(turnRequestOf({ model: "haiku" }));
      expect(connections).toHaveLength(1);
    }).pipe(Effect.scoped),
  );

  it.live("restarts the process when the restart key changes", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      yield* pool.runTurn(turnRequestOf({ model: "haiku" }));
      yield* pool.runTurn(turnRequestOf({ model: "opus" }));
      expect(connections.map((connection) => connection.isClosed)).toEqual([true, false]);
    }).pipe(Effect.scoped),
  );

  it.live("closes an idle process", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "20 millis" });
      yield* pool.runTurn(turnRequestOf());
      yield* Effect.sleep("100 millis");
      expect(connections[0]?.isClosed).toBe(true);
    }).pipe(Effect.scoped),
  );

  it.live("starts another process for the next turn after an idle close", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "20 millis" });
      yield* pool.runTurn(turnRequestOf());
      yield* Effect.sleep("100 millis");
      yield* pool.runTurn(turnRequestOf());
      expect(connections).toHaveLength(2);
    }).pipe(Effect.scoped),
  );

  it.live("closes every process when its scope ends", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf();
      yield* Effect.scoped(
        Effect.gen(function* () {
          const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
          yield* pool.runTurn(turnRequestOf());
        }),
      );
      expect(connections[0]?.isClosed).toBe(true);
    }),
  );
});

describe("interrupting and steering a pooled turn", () => {
  it.live("ends a turn whose interrupt the harness never confirms once the grace period passes", () =>
    Effect.gen(function* () {
      const running = yield* Deferred.make<void>();
      const { connections, protocol } = fakeProtocolOf((turn) =>
        Effect.gen(function* () {
          turn.reportUsage(usage);
          yield* Deferred.succeed(running, void 0);
          return yield* Effect.never;
        }),
      );
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes", interruptGrace: "50 millis" });
      const turn = yield* Effect.forkChild(pool.runTurn(turnRequestOf()));
      yield* Deferred.await(running);
      expect(yield* pool.interrupt("thread-1")).toBe(true);
      const outcome = yield* Fiber.join(turn);
      expect(outcome).toEqual({ billing: "Unknown", cost: null, isInterrupted: true, sessionId: "session-1", usage });
      expect(connections[0]?.isClosed).toBe(true);
      expect(yield* pool.interrupt("thread-1")).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.live("cancels a turn interrupted while its process still starts, without running it", () =>
    Effect.gen(function* () {
      const starting = yield* Deferred.make<void>();
      const released = yield* Deferred.make<void>();
      let ran = false;
      const { connections, protocol } = fakeProtocolOf(() => {
        ran = true;
        return Effect.succeed({ isInterrupted: false, usage: null });
      });
      const slow: HarnessProtocol<FakeConnection> = {
        ...protocol,
        start: (request, signals) =>
          Deferred.succeed(starting, void 0).pipe(
            Effect.andThen(Deferred.await(released)),
            Effect.andThen(protocol.start(request, signals)),
          ),
      };
      const pool = yield* makeHarnessProcesses(slow, { idleTimeout: "10 minutes" });
      const turn = yield* Effect.forkChild(pool.runTurn(turnRequestOf()));
      yield* Deferred.await(starting);
      expect(yield* pool.interrupt("thread-1")).toBe(true);
      yield* Deferred.succeed(released, void 0);
      const outcome = yield* Fiber.join(turn);
      expect(outcome).toEqual({
        billing: "Unknown",
        cost: null,
        isInterrupted: true,
        sessionId: "session-1",
        usage: null,
      });
      expect(ran).toBe(false);
      expect(connections[0]?.isClosed).toBe(false);
      // The interrupt was spent on that turn: the next one runs.
      expect((yield* pool.runTurn(turnRequestOf())).isInterrupted).toBe(false);
      expect(ran).toBe(true);
    }).pipe(Effect.scoped),
  );

  it.live("counts an end the harness reports while interrupting as interrupted, keeping the process", () =>
    Effect.gen(function* () {
      const running = yield* Deferred.make<void>();
      const { connections, protocol } = fakeProtocolOf((turn) =>
        Effect.gen(function* () {
          yield* Deferred.succeed(running, void 0);
          while (!turn.isInterrupting()) yield* Effect.sleep("5 millis");
          return { isInterrupted: false, usage };
        }),
      );
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const turn = yield* Effect.forkChild(pool.runTurn(turnRequestOf()));
      yield* Deferred.await(running);
      yield* pool.interrupt("thread-1");
      expect((yield* Fiber.join(turn)).isInterrupted).toBe(true);
      expect(connections[0]?.isClosed).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.live("keeps the process when a steered message is taken in", () =>
    Effect.gen(function* () {
      const running = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const { connections, protocol } = fakeProtocolOf((turn) =>
        Effect.gen(function* () {
          yield* Deferred.succeed(running, void 0);
          yield* Deferred.await(release);
          yield* turn.deliver("taken");
          return { isInterrupted: false, usage: null };
        }),
      );
      const delivered: Array<string> = [];
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const onEvent = (event: Parameters<TurnRequest["onEvent"]>[0]) =>
        Effect.sync(() => void (event._tag === "Delivered" && delivered.push(event.messageId)));

      const first = yield* Effect.forkChild(pool.runTurn(turnRequestOf({ onEvent })));
      yield* Deferred.await(running);
      expect(yield* pool.steer("thread-1", { id: "taken", images: [], text: "Also this" })).toBe(true);
      yield* Deferred.succeed(release, void 0);
      yield* Fiber.join(first);
      expect(delivered).toEqual(["taken"]);
      expect(connections[0]?.isClosed).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.live("closes the process when a steered message was not taken in by the turn's end", () =>
    Effect.gen(function* () {
      const again = yield* Deferred.make<void>();
      const { connections: later, protocol: holding } = fakeProtocolOf(() =>
        Deferred.succeed(again, void 0).pipe(
          Effect.andThen(Effect.sleep("30 millis")),
          Effect.as({ isInterrupted: false, usage: null }),
        ),
      );
      const other = yield* makeHarnessProcesses(holding, { idleTimeout: "10 minutes" });
      const second = yield* Effect.forkChild(other.runTurn(turnRequestOf()));
      yield* Deferred.await(again);
      expect(yield* other.steer("thread-1", { id: "untaken", images: [], text: "Too late" })).toBe(true);
      yield* Fiber.join(second);
      expect(later[0]?.isClosed).toBe(true);
    }).pipe(Effect.scoped),
  );

  it.live("ends the turn with the failure of work run beside it, such as an unanswerable prompt", () =>
    Effect.gen(function* () {
      const { connections, protocol } = fakeProtocolOf((turn, request) =>
        Effect.gen(function* () {
          yield* turn.fork(request.askOwner({ input: { command: "git push" }, toolName: "Bash" }).pipe(Effect.asVoid));
          return yield* Effect.never;
        }),
      );
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const failure = yield* pool
        .runTurn(turnRequestOf({ askOwner: () => Effect.fail(new HarnessFailure({ reason: "No answer." })) }))
        .pipe(Effect.flip);
      expect(failure.reason).toBe("No answer.");
      expect(connections[0]?.isClosed).toBe(true);
    }).pipe(Effect.scoped),
  );
});

describe("a process that wakes itself between turns", () => {
  type WakingConnection = HarnessConnection & { isClosed: boolean; hasBackground: boolean; isStirredNow: boolean };

  /** Marks the first process as woken, and has it tell the pool so. */
  const stir = (connections: ReadonlyArray<WakingConnection>) => {
    const connection = connections[0];
    if (connection !== undefined) connection.isStirredNow = true;
  };
  const signal = (signals: ReadonlyArray<ProcessSignals>) => signals[0]?.resume();

  /** A fake protocol whose process can be stirred and can run background work; `held` keeps a turn running. */
  const wakingProtocolOf = (held: Deferred.Deferred<void> | null = null) => {
    const started = Deferred.makeUnsafe<void>();
    const closed = Deferred.makeUnsafe<void>();
    const connections: Array<WakingConnection> = [];
    const signals: Array<ProcessSignals> = [];
    const resumed: Array<TurnRequest> = [];
    const protocol: HarnessProtocol<WakingConnection> = {
      interrupt: () => Effect.succeed(true),
      restartKeyOf: (request) => request.model,
      runTurn: (connection, request) =>
        Effect.gen(function* () {
          if (request.isResuming === true) resumed.push(request);
          else {
            yield* Deferred.succeed(started, void 0);
            if (held !== null) yield* Deferred.await(held);
          }
          connection.isStirredNow = false;
          return { isInterrupted: false, usage: null } satisfies TurnEnd;
        }),
      start: (_request, startedSignals) =>
        Effect.sync(() => {
          const connection: WakingConnection = {
            close: () => {
              connection.isClosed = true;
              Deferred.doneUnsafe(closed, Effect.void);
            },
            hasBackground: false,
            hasBackgroundWork: () => connection.hasBackground,
            hasExited: () => connection.isClosed,
            isClosed: false,
            isStirred: () => connection.isStirredNow,
            isStirredNow: false,
            sessionId: `session-${connections.length + 1}`,
          };
          connections.push(connection);
          signals.push(startedSignals);
          return connection;
        }),
      steer: () => Effect.succeed(true),
    };
    return { closed, connections, protocol, resumed, signals, started };
  };

  it.effect("asks its listener for a turn and runs it on the same process", () =>
    Effect.gen(function* () {
      const { connections, protocol, resumed, signals } = wakingProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const finished = yield* Deferred.make<void>();
      const asked: Array<string> = [];
      pool.onResume((threadId) => {
        asked.push(threadId);
        return pool
          .runTurn(turnRequestOf({ isResuming: true, text: "" }))
          .pipe(Effect.andThen(Deferred.succeed(finished, void 0)), Effect.as(true), Effect.orDie);
      });
      yield* pool.runTurn(turnRequestOf());
      stir(connections);
      signal(signals);
      yield* Deferred.await(finished);
      expect(asked).toEqual(["thread-1"]);
      expect(resumed).toHaveLength(1);
      expect(connections).toHaveLength(1);
      expect(connections[0]?.isClosed).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.effect("asks once when the process signals again before a turn begins", () =>
    Effect.gen(function* () {
      const { connections, protocol, signals } = wakingProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      const asked = yield* Deferred.make<string>();
      const release = yield* Deferred.make<void>();
      let calls = 0;
      pool.onResume((threadId) =>
        Effect.gen(function* () {
          calls += 1;
          yield* Deferred.succeed(asked, threadId);
          yield* Deferred.await(release);
          return true;
        }),
      );
      yield* pool.runTurn(turnRequestOf());
      stir(connections);
      signal(signals);
      expect(yield* Deferred.await(asked)).toBe("thread-1");
      signal(signals);
      yield* Effect.yieldNow;
      expect(calls).toBe(1);
      yield* Deferred.succeed(release, void 0);
    }).pipe(Effect.scoped),
  );

  it.effect("closes the process when its wake is refused, which would otherwise run unseen", () =>
    Effect.gen(function* () {
      const { closed, connections, protocol, signals } = wakingProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      pool.onResume(() => Effect.succeed(false));
      yield* pool.runTurn(turnRequestOf());
      stir(connections);
      signal(signals);
      yield* Deferred.await(closed);
      expect(connections[0]?.isClosed).toBe(true);
    }).pipe(Effect.scoped),
  );

  it.effect("ignores a process that is not stirred", () =>
    Effect.gen(function* () {
      const { connections, protocol, signals } = wakingProtocolOf();
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      let asked = 0;
      pool.onResume(() => {
        asked += 1;
        return Effect.succeed(true);
      });
      yield* pool.runTurn(turnRequestOf());
      signal(signals);
      yield* Effect.yieldNow;
      expect(asked).toBe(0);
      expect(connections[0]?.isClosed).toBe(false);
    }).pipe(Effect.scoped),
  );

  it.effect("leaves a wake that arrives during a turn to that turn, and asks for none after it", () =>
    Effect.gen(function* () {
      const held = yield* Deferred.make<void>();
      const { connections, protocol, signals, started } = wakingProtocolOf(held);
      const pool = yield* makeHarnessProcesses(protocol, { idleTimeout: "10 minutes" });
      let asked = 0;
      pool.onResume(() => {
        asked += 1;
        return Effect.succeed(true);
      });
      const turn = yield* Effect.forkChild(pool.runTurn(turnRequestOf()));
      yield* Deferred.await(started);
      stir(connections);
      signal(signals);
      expect(asked).toBe(0);
      yield* Deferred.succeed(held, void 0);
      yield* Fiber.join(turn);
      // The turn read the wake, as Claude Code's does with a notification that comes during it.
      yield* Effect.yieldNow;
      expect(asked).toBe(0);
    }).pipe(Effect.scoped),
  );

  it.effect("asks after a turn that ended with a wake it never read", () =>
    Effect.gen(function* () {
      const held = yield* Deferred.make<void>();
      const { connections, protocol, signals, started } = wakingProtocolOf();
      // A turn that never reads the wake: its end leaves `isStirredNow` set.
      const unread: HarnessProtocol<WakingConnection> = {
        ...protocol,
        runTurn: () =>
          Deferred.succeed(started, void 0).pipe(
            Effect.andThen(Deferred.await(held)),
            Effect.as({ isInterrupted: false, usage: null } satisfies TurnEnd),
          ),
      };
      const pool = yield* makeHarnessProcesses(unread, { idleTimeout: "10 minutes" });
      const asked = yield* Deferred.make<string>();
      pool.onResume((id) => Deferred.succeed(asked, id).pipe(Effect.as(true)));
      const turn = yield* Effect.forkChild(pool.runTurn(turnRequestOf()));
      yield* Deferred.await(started);
      stir(connections);
      signal(signals);
      yield* Deferred.succeed(held, void 0);
      yield* Fiber.join(turn);
      expect(yield* Deferred.await(asked)).toBe("thread-1");
    }).pipe(Effect.scoped),
  );

  it.effect("keeps a process with background work longer than an idle one", () =>
    Effect.gen(function* () {
      const { connections, protocol } = wakingProtocolOf();
      // The turn of the thread "busy" leaves a background command running.
      const running: HarnessProtocol<WakingConnection> = {
        ...protocol,
        runTurn: (connection, request, turn) => {
          connection.hasBackground = request.threadId === "busy";
          return protocol.runTurn(connection, request, turn);
        },
      };
      // The pool uses native timers for process retention, so control those timers directly.
      yield* Effect.acquireRelease(
        Effect.sync(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })),
        () => Effect.sync(() => vi.useRealTimers()),
      );
      const pool = yield* makeHarnessProcesses(running, { backgroundHold: "400 millis", idleTimeout: "20 millis" });
      yield* pool.runTurn(turnRequestOf({ threadId: "idle" }));
      yield* pool.runTurn(turnRequestOf({ threadId: "busy" }));
      vi.advanceTimersByTime(20);
      expect(connections.map((connection) => connection.isClosed)).toEqual([true, false]);
      vi.advanceTimersByTime(380);
      expect(connections[1]?.isClosed).toBe(true);
    }).pipe(Effect.scoped),
  );
});
