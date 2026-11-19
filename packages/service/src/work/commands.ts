import { join } from "node:path";
import { Context, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Connectors } from "../connectors/index.ts";
import { Changes, removeScratch } from "../core/index.ts";
import { Approvals } from "./approvals.ts";
import { recordOnce } from "./commandOutcomes.ts";
import { Suggestions } from "./suggestions.ts";
import { Threads } from "./threads.ts";
import { ScratchRoot } from "./workspaces.ts";

// A command is a domain operation and what must follow once its storage work commits. The operation
// only describes: it writes inside the transaction it is given and returns its follow-ups. The runner
// alone commits, announces, and applies them, so no caller can forget a wake or announce a rollback.

/** What a command leaves to do once its storage work has committed. */
export type FollowUps = {
  /** Whether state the owner sees changed, so open screens refetch. */
  readonly isChanged: boolean;
  /** Deleted quests whose service-owned scratch folder can now be removed. */
  readonly missionsToRemoveScratch: ReadonlyArray<string>;
  /** Missions whose waiting threads may now run, a running slot having freed. */
  readonly missionsToWake: ReadonlyArray<string>;
  /** Whether a connector's switch changed in a way that may take a tool from a thread: calls underway are stopped. */
  readonly shouldStopConnectorCalls: boolean;
  /** Threads with messages to deliver. */
  readonly threadsToWake: ReadonlyArray<string>;
  /** Threads whose pending owner questions must be withdrawn before any wake. */
  readonly threadsToWithdraw: ReadonlyArray<string>;
  /** Threads whose turns the operation invalidated and that must now end. */
  readonly turnsToCancel: ReadonlyArray<string>;
};

/** A domain operation's value with its follow-ups. */
export type WithFollowUps<A> = {
  readonly followUps: FollowUps;
  readonly value: A;
};

/** The follow-ups of an operation that changed nothing the owner sees and leaves nothing to do. */
export const noFollowUps: FollowUps = {
  isChanged: false,
  missionsToRemoveScratch: [],
  missionsToWake: [],
  shouldStopConnectorCalls: false,
  threadsToWake: [],
  threadsToWithdraw: [],
  turnsToCancel: [],
};

type FurtherFollowUps = Partial<Omit<FollowUps, "isChanged">>;

/** A value whose operation changed what the owner sees, with any further follow-ups. */
export const changed = <A>(value: A, further: FurtherFollowUps = {}): WithFollowUps<A> => ({
  followUps: { ...noFollowUps, ...further, isChanged: true },
  value,
});

/** A value whose operation changed nothing the owner sees, with any further follow-ups. */
export const unchanged = <A>(value: A, further: FurtherFollowUps = {}): WithFollowUps<A> => ({
  followUps: { ...noFollowUps, ...further, isChanged: false },
  value,
});

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
  readonly threads: Pick<Threads["Service"], "cancel" | "wake" | "wakeMission">;
}): CommandRunner => {
  const { publish, sql, threads } = dependencies;
  const apply = Effect.fn("applyFollowUps")(function* (followUps: FollowUps) {
    if (followUps.isChanged) yield* publish;
    // Once committed, so a call a rolled-back change would have stopped is never stopped.
    if (followUps.shouldStopConnectorCalls && dependencies.stopConnectorCalls !== undefined)
      yield* dependencies.stopConnectorCalls;
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
    for (const id of new Set(followUps.missionsToWake)) yield* threads.wakeMission(id);
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

/** The runner over the service's store, change feed, and threads. */
export const commandsLayer = Layer.effect(
  Commands,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const threads = yield* Threads;
    const scratchRoot = yield* ScratchRoot;
    const approvals = yield* Approvals;
    const suggestions = yield* Suggestions;
    // The connectors are the service's own; a runner built without them stops no connector call.
    const connectors = yield* Effect.serviceOption(Connectors);
    return makeCommands({
      publish: changes.publish,
      removeScratch: (id) =>
        removeScratch(join(scratchRoot, id)).pipe(Effect.provideService(SqlClient.SqlClient, sql), Effect.orDie),
      sql,
      ...(connectors._tag === "Some" ? { stopConnectorCalls: connectors.value.stopRevokedCalls } : {}),
      threads,
      withdrawQuestions: (id) => approvals.withdraw(id).pipe(Effect.andThen(suggestions.withdraw(id))),
    });
  }),
);
