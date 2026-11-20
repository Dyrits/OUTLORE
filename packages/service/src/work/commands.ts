import { Context, Effect } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { recordOnce } from "./commandOutcomes.ts";
import type { FollowUps, WithFollowUps } from "./followUps.ts";

// A command is a domain operation and what must follow once its storage work commits. The operation
// only describes: it writes inside the transaction it is given and returns its follow-ups. The runner
// alone commits, announces, and applies them, so no caller can forget a wake or announce a rollback.

/** Runs commands: one transaction, one announcement after commit, then cancels, then wakes. */
export interface CommandRunner {
  /**
   * Applies the follow-ups of an operation that commits on its own, as one that waits on the owner must,
   * in the same order as `run`.
   */
  readonly apply: (followUps: FollowUps) => Effect.Effect<void>;
  /** Records one request outcome and its replay wakes inside the command transaction. */
  readonly once: typeof recordOnce;
  /**
   * Runs the operation in one transaction and returns its value. Only once it commits: announces the
   * change, cancels the turns, then wakes the threads and the missions. A failed transaction does none.
   */
  readonly run: <A, E, R>(
    operation: Effect.Effect<WithFollowUps<A>, E, R>,
  ) => Effect.Effect<A, E | SqlError.SqlError, Exclude<R, SqlClient.SqlClient>>;
}

/** A runner over the store, the change feed, and the threads' turns. */
export const makeCommands = (dependencies: {
  readonly withdrawQuestions: (threadId: string) => Effect.Effect<void>;
  readonly removeScratch: (missionId: string) => Effect.Effect<void>;
  /** Stops the connector calls whose tool a committed change took from their thread; none stop when left out. */
  readonly stopConnectorCalls?: Effect.Effect<void>;
  readonly sql: SqlClient.SqlClient;
  readonly publish: Effect.Effect<void>;
  readonly threads: {
    readonly cancel: (ids: ReadonlyArray<string>) => Effect.Effect<void>;
    readonly wake: (threadId: string) => Effect.Effect<void>;
    readonly wakeMission: (missionId: string, exceptThreadIds?: ReadonlyArray<string>) => Effect.Effect<void>;
  };
}): CommandRunner => {
  const { publish, sql, threads } = dependencies;
  const apply = Effect.fn("applyFollowUps")(function* (followUps: FollowUps) {
    if (followUps.isChanged) yield* publish;
    // Cancelled before any wake, so a woken thread never races a turn that is still ending.
    if (followUps.turnsToCancel.length > 0) yield* threads.cancel(followUps.turnsToCancel);
    for (const id of followUps.threadsToWithdraw) yield* dependencies.withdrawQuestions(id);
    for (const id of followUps.missionsToRemoveScratch) {
      // The deletion is already committed. A scratch failure must not prevent attachment cleanup or
      // report that committed deletion as failed; startup reconciliation will retry the folder.
      yield* dependencies
        .removeScratch(id)
        .pipe(
          Effect.catchCause((cause) => Effect.logWarning(`Scratch cleanup will retry quest ${id} at startup`, cause)),
        );
    }
    for (const id of followUps.threadsToWake) yield* threads.wake(id);
    for (const id of new Set(followUps.missionsToWake)) yield* threads.wakeMission(id, followUps.turnsToCancel);
    if (followUps.shouldStopConnectorCalls && dependencies.stopConnectorCalls !== undefined)
      yield* dependencies.stopConnectorCalls;
  });
  const run = <A, E, R>(operation: Effect.Effect<WithFollowUps<A>, E, R>) =>
    sql.withTransaction(operation).pipe(
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.tap((done) => apply(done.followUps)),
      Effect.map((done) => done.value),
    );
  return { apply, once: recordOnce, run };
};

/** The runner every owner request and thread tool goes through. */
export class Commands extends Context.Service<Commands, CommandRunner>()("outlore/Commands") {}
