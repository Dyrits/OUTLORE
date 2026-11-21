import type { ThreadActions, ThreadState } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound, touchMission } from "../core/index.ts";
import { changed, unchanged } from "./followUps.ts";

// The thread lifecycle: the one module that writes a thread's state and blocker (thread-tree, Thread
// states). Callers decide which threads and which transition; each transition keeps the tree's rules,
// such as a parent left Waiting with nothing at work beneath it becoming Resting. Transitions run inside
// the caller's transaction; the command that calls one returns what follows it (commands.ts), and
// `makeLifecycle` owns cancelling a thread's turn outside any transaction.

/** New errands are opened directly beneath the quest. */
export const maxOwnerDepth = 1;

/** States in which a thread beneath keeps its parent Waiting. */
export const activeStates = ["Underway", "Waiting", "Attention"];

/** What a thread waits on the owner for outside a turn: a missing folder, chatter, or a budget. */
export type HoldReason = "MissingWorkspace" | "Chatter" | "Budget";

/** Threads waiting on the owner inside a turn (a question or a suggestion), as an SQL condition on `threads`. */
export const waitsInTurn = "(state = 'Attention' AND blocker IS NULL)";

/**
 * Parents left Waiting with nothing active beneath them become Resting, up the tree from the given thread.
 * Callers run it in a transaction.
 */
const relaxAncestors = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  let current: string | null = threadId;
  while (current !== null) {
    const [row]: ReadonlyArray<{ parentId: string | null }> = yield* sql<{
      parentId: string | null;
    }>`SELECT parent_id AS parentId FROM threads WHERE id = ${current}`;
    const parentId: string | null = row?.parentId ?? null;
    if (parentId === null) return;
    const [parent] = yield* sql<{ state: string; active: number }>`
        SELECT state, (SELECT COUNT(*) FROM threads c WHERE c.parent_id = ${parentId}
          AND c.state IN ${sql.in(activeStates)}) AS active
        FROM threads WHERE id = ${parentId}`;
    if (parent?.state !== "Waiting" || parent.active > 0) return;
    yield* sql`UPDATE threads SET state = 'Resting' WHERE id = ${parentId}`;
    current = parentId;
  }
});

/** What the owner can do with a thread in this state, for every interface to offer the same. */
export const threadActionsOf = (thread: {
  readonly state: ThreadState;
  readonly blocker: string | null;
  readonly depth: number;
}): ThreadActions => ({
  canOpenBeneath: thread.depth < maxOwnerDepth,
  canResume: thread.state === "Stopped",
  canStop: activeStates.includes(thread.state),
  isInTurn: thread.state === "Underway" || (thread.state === "Attention" && thread.blocker === null),
});

/** A turn starts: the thread is Underway and its last failure clears. */
export const startRunning = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Underway', failure = NULL WHERE id = ${threadId}`;
});

/**
 * A turn ends: the thread is Fulfilled if it reported its result in it, Waiting with work still at work
 * beneath it, otherwise Resting; its parents relax.
 */
export const endTurn = Effect.fnUntraced(function* (threadId: string, turnId: string, sessionId: string | null) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ reportedTurnId: string | null; active: number }>`
      SELECT reported_turn_id AS reportedTurnId,
        (SELECT COUNT(*) FROM threads c WHERE c.parent_id = ${threadId} AND c.state IN ${sql.in(activeStates)})
          AS active
      FROM threads WHERE id = ${threadId}`;
  const state = row?.reportedTurnId === turnId ? "Fulfilled" : (row?.active ?? 0) > 0 ? "Waiting" : "Resting";
  yield* sql`UPDATE threads SET state = ${state}, session_id = ${sessionId}, failure = NULL WHERE id = ${threadId}`;
  yield* relaxAncestors(threadId);
});

/** A turn fails: the thread shows Failed with the reason; its parents relax. */
export const failTurn = Effect.fnUntraced(function* (threadId: string, reason: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Failed', failure = ${reason} WHERE id = ${threadId}`;
  yield* relaxAncestors(threadId);
});

/** An Underway thread asks the owner inside its turn and waits in Attention. */
export const holdInTurn = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Attention' WHERE id = ${threadId} AND state = 'Underway'`;
});

/** The owner answered inside the turn: the thread is Underway again once no question or suggestion stays open. */
export const resumeInTurn = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Underway'
      WHERE id = ${threadId} AND ${sql.literal(waitsInTurn)}
        AND NOT EXISTS (SELECT 1 FROM questions WHERE thread_id = ${threadId} AND outcome IS NULL)
        AND NOT EXISTS (SELECT 1 FROM suggestions WHERE thread_id = ${threadId} AND outcome IS NULL)`;
});

/** A thread about to start a turn waits in Attention for a reason outside any turn instead. */
export const holdThread = Effect.fnUntraced(function* (threadId: string, reason: HoldReason) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Attention', blocker = ${reason}
      WHERE id = ${threadId} AND state != 'Stopped' AND is_deleting = 0`;
});

/**
 * Holds the thread a question shows on, such as a budget stop's, unless it works, has failed, or already
 * waits on the owner for another reason: the question still shows on it, and its own state stays.
 */
export const holdQuestionHolder = Effect.fnUntraced(function* (threadId: string, reason: HoldReason) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Attention', blocker = ${reason}
      WHERE id = ${threadId} AND state NOT IN ('Stopped', 'Underway', 'Failed') AND is_deleting = 0
        AND (blocker IS NULL OR blocker = ${reason})`;
});

/** Releases a held thread, which becomes Resting and runs its kept messages once woken. */
export const releaseThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Resting', blocker = NULL WHERE id = ${threadId}`;
});

/** Releases the threads held only by chatter pauses since resolved; other reasons and Stop still win. */
export const releaseResolvedChatter = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Resting', blocker = NULL
    WHERE blocker = 'Chatter' AND state = 'Attention' AND NOT EXISTS (
      SELECT 1 FROM chatter WHERE pause_id IS NOT NULL AND (first_id = threads.id OR second_id = threads.id))`;
});

/** A Stopped thread continues: it becomes Resting and runs its kept messages once woken. */
export const resumeStopped = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = 'Resting' WHERE id = ${threadId}`;
});

/**
 * At startup no turn runs: threads left Underway, Waiting, or waiting inside a turn become Resting; those
 * held for a reason outside any turn keep waiting (provisional until recovery is settled: work-in-progress,
 * Open questions).
 */
export const recoverThreadStates = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // Deletion commits records before removing files. Surviving rows still own all their files and can
  // be offered again after a crash between marking, erasing, and rollback compensation.
  yield* sql`UPDATE threads SET is_deleting = 0, state = 'Stopped', blocker = NULL WHERE is_deleting = 1`;
  yield* sql`UPDATE threads SET state = 'Resting'
    WHERE state IN ('Underway', 'Waiting') OR ${sql.literal(waitsInTurn)}`;
});

/**
 * Invalidates active turns before cancellation so late output cannot change a paused or stopped thread.
 * Stopping also returns each parent left Waiting with nothing at work beneath it to Resting (thread-tree,
 * Thread states), whichever path stops the threads. The command that halts threads returns them as turns to
 * cancel.
 */
export const haltThreads = Effect.fn("haltThreads")(function* (
  ids: ReadonlyArray<string>,
  state: "Stopped" | "Attention" | "Resting",
  attentionBlocker: "Chatter" | "Budget" = "Chatter",
) {
  const sql = yield* SqlClient.SqlClient;
  if (ids.length === 0) return;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE turns SET status = 'stopped', ended_at = ${now}
    WHERE thread_id IN ${sql.in(ids)} AND status = 'running'`;
  yield* sql`UPDATE threads SET state = ${state}, generation = generation + 1,
    blocker = ${state === "Attention" ? attentionBlocker : null} WHERE id IN ${sql.in(ids)}`;
  if (state !== "Attention") for (const id of ids) yield* relaxAncestors(id);
});

/** The mission a thread belongs to, or null for an unknown thread. */
export const readMissionIdOf = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ missionId: string }>`SELECT mission_id AS missionId FROM threads WHERE id = ${threadId}`;
  return row?.missionId ?? null;
});

/**
 * The owner or a harness stops a thread: its turn is invalidated and it returns to Resting; its turn is then
 * cancelled and the mission's waiting threads may take the freed slot. Nothing follows for an unknown thread.
 */
export const stopThread = Effect.fn("stopThread")(function* (threadId: string) {
  const missionId = yield* readMissionIdOf(threadId);
  if (missionId === null) return unchanged(null);
  const sql = yield* SqlClient.SqlClient;
  const pauses =
    yield* sql`SELECT 1 FROM chatter WHERE pause_id IS NOT NULL AND (first_id = ${threadId} OR second_id = ${threadId})`;
  yield* haltThreads([threadId], pauses.length > 0 ? "Attention" : "Resting");
  yield* touchMission(missionId, yield* Clock.currentTimeMillis);
  return changed(null, { missionsToWake: [missionId], turnsToCancel: [threadId] });
});

/**
 * The owner marks an errand done without ending its quest: its turn is stopped and invalidated, the thread becomes
 * Fulfilled, and each parent left Waiting with nothing at work beneath it returns to Resting. The quest's top thread is not
 * an errand: it ends with its quest.
 */
export const markThreadDone = Effect.fn("markThreadDone")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ missionId: string; parentId: string | null }>`
    SELECT mission_id AS missionId, parent_id AS parentId FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
  if (thread === undefined) return yield* notFound("No such thread.");
  if (thread.parentId === null)
    return yield* invalid("The quest's own thread ends with the quest: mark the quest done.");
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE turns SET status = 'stopped', ended_at = ${now} WHERE thread_id = ${threadId} AND status = 'running'`;
  yield* sql`UPDATE threads SET state = 'Fulfilled', generation = generation + 1, blocker = NULL, failure = NULL
    WHERE id = ${threadId}`;
  yield* relaxAncestors(threadId);
  yield* touchMission(thread.missionId, now);
  return changed(null, { missionsToWake: [thread.missionId], turnsToCancel: [threadId] });
});

/** Returns a fulfilled errand to the owner's turn. */
export const reopenThread = Effect.fn("reopenThread")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{
    missionId: string;
    parentId: string | null;
    state: string;
    archivedAt: number | null;
  }>`SELECT mission_id AS missionId, parent_id AS parentId, state, archived_at AS archivedAt FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
  if (thread === undefined) return yield* notFound("No such thread.");
  if (thread.parentId === null || thread.state !== "Fulfilled" || thread.archivedAt !== null)
    return yield* invalid("This errand cannot be reopened.");
  yield* sql`UPDATE threads SET state = 'Resting' WHERE id = ${threadId}`;
  yield* touchMission(thread.missionId, yield* Clock.currentTimeMillis);
  return changed(null);
});

/** The errand and the errands beneath it, with their states and whether the owner archived them. */
const readErrandTree = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    archivedAt: number | null;
    id: string;
    missionId: string;
    parentArchivedAt: number | null;
    parentId: string | null;
    state: string;
  }>`WITH RECURSIVE subtree(id) AS (
      SELECT id FROM threads WHERE id = ${threadId}
      UNION ALL SELECT t.id FROM threads t JOIN subtree s ON t.parent_id = s.id
    )
    SELECT t.id, t.mission_id AS missionId, t.parent_id AS parentId, t.state, t.archived_at AS archivedAt,
      (SELECT p.archived_at FROM threads p WHERE p.id = t.parent_id) AS parentArchivedAt
    FROM threads t JOIN subtree s ON s.id = t.id WHERE t.is_deleting = 0 ORDER BY t.rowid`;
  const [root] = rows;
  if (root === undefined) return yield* notFound("No such thread.");
  if (root.parentId === null) return yield* invalid("The quest's own thread ends with the quest: archive the quest.");
  return rows;
});

/**
 * The owner archives an errand on its own: it and the errands beneath it stop if they are at work, and leave the
 * lists, their conversations kept. Each parent left Waiting with nothing at work beneath it returns to Resting.
 */
export const archiveThread = Effect.fn("archiveThread")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* readErrandTree(threadId);
  const ids = rows.map((row) => row.id);
  const working = rows.filter((row) => activeStates.includes(row.state)).map((row) => row.id);
  const now = yield* Clock.currentTimeMillis;
  yield* haltThreads(working, "Stopped");
  yield* sql`UPDATE threads SET archived_at = ${now} WHERE id IN ${sql.in(ids)} AND archived_at IS NULL`;
  const [root] = rows;
  if (root !== undefined) yield* relaxAncestors(root.id);
  yield* touchMission(rows[0]?.missionId ?? "", now);
  return changed(null, { missionsToWake: rows[0] === undefined ? [] : [rows[0].missionId], turnsToCancel: working });
});

/** The owner brings an archived errand back with the errands archived beneath it; its parent must not be archived. */
export const restoreThread = Effect.fn("restoreThread")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* readErrandTree(threadId);
  const [root] = rows;
  if (root === undefined || root.archivedAt === null) return yield* invalid("This errand is not archived.");
  if (root.parentArchivedAt !== null) return yield* invalid("Restore the errand above it first.");
  yield* sql`UPDATE threads SET archived_at = NULL WHERE id IN ${sql.in(rows.map((row) => row.id))}`;
  yield* touchMission(root.missionId, yield* Clock.currentTimeMillis);
  return changed(null);
});

/** Owns cancelling threads' turns without holding a database transaction while a harness exits. */
export const makeLifecycle = (dependencies: {
  /** Withdraws everything the thread waits on the owner for. */
  readonly withdraw: (id: string) => Effect.Effect<void>;
  readonly cancelTurn: (id: string) => Effect.Effect<void>;
  readonly clearDraft: (id: string) => Effect.Effect<void>;
}) => {
  const { withdraw, cancelTurn, clearDraft } = dependencies;
  const cancel = Effect.fn("cancelThreads")(function* (ids: ReadonlyArray<string>) {
    for (const id of ids) {
      yield* cancelTurn(id);
      yield* withdraw(id);
      yield* clearDraft(id);
    }
  });
  return { cancel };
};
