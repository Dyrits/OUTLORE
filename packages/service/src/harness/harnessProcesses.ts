import { Deferred, Duration, Effect } from "effect";
import {
  type BackgroundWakeListener,
  type HarnessAdapter,
  HarnessFailure,
  interruptedOutcomeOf,
  interruptGraceMillis,
  runKeyOf,
  type SteeredMessage,
  type TurnOutcome,
  type TurnRequest,
} from "../core/index.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  type PooledTurn,
  type PoolOptions,
  type ProcessEntry,
  type ProcessSignals,
  pooledTurnControlOf,
  type RunningTurn,
  type TurnEnd,
} from "./harnessProtocol.ts";

export type { HarnessConnection, HarnessProtocol, PooledTurn, PoolOptions, ProcessSignals, TurnEnd };

// Each run's harness process, kept between turns (CHG-0027); a thread's main run is keyed by the thread's id, and a run beside it has a process of its own: started or reused by the restart key its harness declares, closed when idle, when an interrupt goes unconfirmed, when a steered message was not taken in, and with the scope that made the pool.
// The harness's protocol only speaks to the process.
// A process may also wake itself between turns, as Claude Code does when a background command ends: the pool then asks its listener to run that work as a turn of the thread, and keeps a process with such work pending longer.

/** An adapter that runs each run's turns on one kept process of the harness (a thread's main run, or a side run beside it); its processes close with its scope. */
export const makeHarnessProcesses = Effect.fnUntraced(function* <Connection extends HarnessConnection>(
  protocol: HarnessProtocol<Connection>,
  options: PoolOptions,
) {
  // Keyed by run key: a side run's process neither replaces nor closes the thread's main process.
  const entries = new Map<string, ProcessEntry<Connection>>();
  /** Runs whose turn has begun but whose process is not yet running it, with whether an interrupt came meanwhile. */
  const starting = new Map<string, { isInterrupted: boolean }>();
  const idleMillis = Duration.toMillis(Duration.fromInputUnsafe(options.idleTimeout));
  const grace = options.interruptGrace ?? interruptGraceMillis;
  const backgroundMillis = Duration.toMillis(Duration.fromInputUnsafe(options.backgroundHold ?? "1 hour"));
  const listeners: Array<BackgroundWakeListener> = [];
  const fork = Effect.runForkWith(yield* Effect.context<never>());
  /** How long the process is kept now: longer while it runs work that will wake it. */
  const holdMillisOf = (connection: HarnessConnection) =>
    connection.hasBackgroundWork?.() === true ? Math.max(idleMillis, backgroundMillis) : idleMillis;

  const close = (runKey: string) => {
    const entry = entries.get(runKey);
    if (entry === undefined) return;
    entries.delete(runKey);
    if (entry.idleTimer !== null) clearTimeout(entry.idleTimer);
    entry.connection.close();
  };
  yield* Effect.addFinalizer(() => Effect.sync(() => [...entries.keys()].forEach(close)));

  /**
   * Asks for a turn when the thread's process woke itself and none runs; nobody taking it closes the process. Only a
   * main run's process wakes its thread: a turn of the thread would be its main turn, which a side run does not own.
   */
  const resume = (runKey: string, threadId: string) => {
    const entry = entries.get(runKey);
    if (
      runKey !== threadId ||
      entry === undefined ||
      entry.turn !== null ||
      entry.settling !== null ||
      entry.isTakingBackgroundWake ||
      starting.has(runKey)
    )
      return;
    if (entry.connection.hasExited() || entry.connection.hasBackgroundWake?.() !== true || listeners.length === 0)
      return;
    entry.isTakingBackgroundWake = true;
    fork(
      Effect.gen(function* () {
        const answers = yield* Effect.forEach(listeners, (listener) => listener(threadId));
        const isTaken = answers.some((answer) => answer);
        if (!isTaken && entries.get(runKey) === entry && entry.turn === null && !starting.has(runKey)) close(runKey);
      }),
    );
  };

  const acquire = Effect.fnUntraced(function* (request: TurnRequest) {
    const runKey = runKeyOf(request);
    const key = yield* Effect.sync(() => protocol.restartKeyOf(request));
    const existing = entries.get(runKey);
    if (existing !== undefined && (existing.key !== key || existing.connection.hasExited())) close(runKey);
    const kept = entries.get(runKey);
    if (kept !== undefined) {
      if (kept.idleTimer !== null) clearTimeout(kept.idleTimer);
      kept.idleTimer = null;
      return kept;
    }
    // A wake has no prompt to send, so a replacement process has no work to run or result to return.
    if (request.isBackgroundWake === true)
      return yield* new HarnessFailure({ reason: "The harness process that woke this thread is no longer available." });
    const entry: ProcessEntry<Connection> = {
      connection: yield* protocol.start(request, { resume: () => resume(runKey, request.threadId) }),
      idleTimer: null,
      isTakingBackgroundWake: false,
      key,
      settling: null,
      turn: null,
    };
    entries.set(runKey, entry);
    return entry;
  });

  const runTurn = Effect.fnUntraced(
    function* (request: TurnRequest) {
      const runKey = runKeyOf(request);
      const startingEntry = { isInterrupted: false };
      starting.set(runKey, startingEntry);
      const entry = yield* acquire(request).pipe(Effect.ensuring(Effect.sync(() => starting.delete(runKey))));
      const { sessionId } = entry.connection;
      // An interrupt that came while the process started cancels the turn before its prompt is sent, which the harness could not cancel yet; the process stays for the next turn.
      if (startingEntry.isInterrupted) {
        entry.idleTimer = setTimeout(() => close(runKey), idleMillis);
        return interruptedOutcomeOf(sessionId);
      }
      const turn: RunningTurn = {
        failed: yield* Deferred.make<never, HarnessFailure>(),
        interrupted: yield* Deferred.make<void>(),
        isInterrupting: false,
        onEvent: request.onEvent,
        untaken: new Set(),
        usage: null,
      };
      entry.turn = turn;
      entry.settling = null;
      entry.isTakingBackgroundWake = false;
      // An interrupt the harness has not confirmed within the grace period ends the turn regardless.
      const unconfirmed = Deferred.await(turn.interrupted).pipe(
        Effect.andThen(Effect.sleep(grace)),
        Effect.as({ _tag: "Unconfirmed" } as const),
      );
      const ended = yield* Effect.raceFirst(
        protocol
          .runTurn(entry.connection, request, pooledTurnControlOf(turn))
          .pipe(Effect.map((end) => ({ _tag: "Ended", end }) as const)),
        Effect.raceFirst(unconfirmed, Deferred.await(turn.failed)),
      ).pipe(
        Effect.result,
        Effect.ensuring(
          Effect.sync(() => {
            entry.settling = turn;
            entry.turn = null;
          }),
        ),
      );
      if (ended._tag === "Failure") {
        close(runKey);
        // A process that dies while interrupted still spent what its earlier prompts reported.
        if (turn.isInterrupting) return interruptedOutcomeOf(sessionId, turn.usage);
        return yield* ended.failure;
      }
      if (ended.success._tag === "Unconfirmed") {
        close(runKey);
        return interruptedOutcomeOf(sessionId, turn.usage);
      }
      // A steered message not yet taken in would start a turn of its own in this process, which nothing reads: the process closes instead, and the message, still undelivered, starts the next turn (CHG-0039, provisional).
      if (turn.untaken.size > 0) close(runKey);
      else {
        entry.idleTimer = setTimeout(() => close(runKey), holdMillisOf(entry.connection));
        // Admission can only claim the wake after the preceding turn is recorded as ended.
        const checkWake = Effect.sync(() => {
          if (entries.get(runKey) !== entry || entry.settling !== turn) return;
          entry.settling = null;
          resume(runKey, request.threadId);
        });
        if (request.awaitSettlement === undefined) yield* checkWake;
        else fork(request.awaitSettlement.pipe(Effect.andThen(checkWake)));
      }
      const { billing, context, contextWindow, cost, isInterrupted, usage } = ended.success.end;
      return {
        billing: billing ?? "Unknown",
        context: context ?? null,
        contextWindow: contextWindow ?? null,
        cost: cost ?? null,
        isInterrupted: isInterrupted || turn.isInterrupting,
        sessionId,
        usage,
      } satisfies TurnOutcome;
    },
    (effect, request) => effect.pipe(Effect.onInterrupt(() => Effect.sync(() => close(runKeyOf(request))))),
  );

  /** The run's entry while a turn runs on a live process, or null. */
  const runningOf = (runKey: string) => {
    const entry = entries.get(runKey);
    return entry === undefined || entry.connection.hasExited() || entry.turn === null
      ? null
      : { connection: entry.connection, turn: entry.turn };
  };

  const steer = Effect.fnUntraced(function* (runKey: string, message: SteeredMessage) {
    const running = runningOf(runKey);
    if (running === null || running.turn.isInterrupting) return false;
    running.turn.untaken.add(message.id);
    const isTaken = yield* protocol.steer(running.connection, message);
    if (!isTaken) running.turn.untaken.delete(message.id);
    return isTaken;
  });

  const interrupt = Effect.fnUntraced(function* (runKey: string) {
    const running = runningOf(runKey);
    if (running === null) {
      const startingEntry = starting.get(runKey);
      if (startingEntry === undefined) return false;
      startingEntry.isInterrupted = true;
      return true;
    }
    if (running.turn.isInterrupting) return true;
    // Set first: the harness may confirm before the request's own effect returns.
    running.turn.isInterrupting = true;
    if (!(yield* protocol.interrupt(running.connection))) {
      running.turn.isInterrupting = false;
      return false;
    }
    yield* Deferred.succeed(running.turn.interrupted, void 0);
    return true;
  });

  // A harness reports no plan limits unless its adapter says how to ask (codex.ts).
  const onBackgroundWake = (listener: BackgroundWakeListener) => {
    listeners.push(listener);
  };
  return {
    interrupt,
    onBackgroundWake,
    readPlanLimits: () => Effect.succeed(null),
    runTurn,
    steer,
  } satisfies HarnessAdapter;
});
