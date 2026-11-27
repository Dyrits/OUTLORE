import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound, touchMission } from "../core/index.ts";
import { eraseEmptyErrand } from "./deleting.ts";
import { emptyErrandCondition } from "./emptyQuest.ts";
import { changed } from "./followUps.ts";
import { activeStates, haltThreads, relaxAncestors } from "./lifecycle.ts";
import { isNotBeingDeletedOf } from "./questVisibility.ts";

// Ending an errand on its own (thread-tree, Thread states): marking it done, reopening it, archiving, and restoring.
// Each transition runs inside the caller's transaction and returns what follows it (commands.ts).

/**
 * The owner marks an errand done without ending its quest: its turn is stopped and invalidated, the thread becomes
 * Fulfilled, and each parent left Waiting with nothing at work beneath it returns to Resting. The quest's top thread is not
 * an errand: it ends with its quest.
 */
export const markThreadDone = Effect.fn("markThreadDone")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ missionId: string; parentId: string | null }>`
    SELECT mission_id AS missionId, parent_id AS parentId FROM threads WHERE id = ${threadId} AND ${isNotBeingDeletedOf(sql, "threads")}`;
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
  }>`SELECT mission_id AS missionId, parent_id AS parentId, state, archived_at AS archivedAt FROM threads WHERE id = ${threadId} AND ${isNotBeingDeletedOf(sql, "threads")}`;
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
    FROM threads t JOIN subtree s ON s.id = t.id WHERE ${isNotBeingDeletedOf(sql)} ORDER BY t.rowid`;
  const [root] = rows;
  if (root === undefined) return yield* notFound("No such thread.");
  if (root.parentId === null) return yield* invalid("The quest's own thread ends with the quest: archive the quest.");
  return rows;
});

/**
 * The owner archives an errand on its own: it and the errands beneath it stop if they are at work, and leave the
 * lists, their conversations kept; an errand holding nothing is deleted instead. Each parent left Waiting with nothing at work beneath it returns to Resting.
 */
export const archiveThread = Effect.fn("archiveThread")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* readErrandTree(threadId);
  const [empty] = yield* sql<{
    isEmpty: number;
  }>`SELECT ${sql.literal(emptyErrandCondition("t.id"))} AS isEmpty FROM threads t WHERE t.id = ${threadId}`;
  // An errand that holds nothing is deleted rather than kept, as an empty quest is.
  if (empty?.isEmpty === 1) return yield* eraseEmptyErrand(threadId);
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
