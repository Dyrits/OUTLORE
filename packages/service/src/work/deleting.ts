import type { DeletionPreview } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound, ServiceFailure } from "../core/index.ts";
import { eraseThreadsLore } from "../lore/index.ts";
import { forgetAttachmentsOf, removeAttachmentFiles } from "./attachments.ts";
import { forgetOutcomesOf } from "./commandOutcomes.ts";
import { Commands, changed, type WithFollowUps } from "./commands.ts";
import { refuseGuildmaster } from "./guildmasterPlace.ts";
import { haltThreads, releaseResolvedChatter } from "./lifecycle.ts";

const readSubtree = Effect.fn("readSubtree")(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string; missionId: string; parentId: string | null; running: number; depth: number }>`
    WITH RECURSIVE subtree(id, depth) AS (
      SELECT id, 0 FROM threads WHERE id = ${threadId}
      UNION ALL SELECT t.id, s.depth + 1 FROM threads t JOIN subtree s ON t.parent_id = s.id
    )
    SELECT t.id, t.mission_id AS missionId, t.parent_id AS parentId, s.depth,
      EXISTS(SELECT 1 FROM turns WHERE thread_id = t.id AND status = 'running') AS running
    FROM threads t JOIN subtree s ON s.id = t.id ORDER BY s.depth, t.id`;
  if (rows.length === 0) return yield* notFound("No such thread.");
  if (rows[0]?.parentId === null) yield* refuseGuildmaster(rows[0].missionId, "deleted");
  return rows;
});

const previewOf = (rows: Effect.Success<ReturnType<typeof readSubtree>>): DeletionPreview => ({
  confirmation: JSON.stringify(rows.map(({ id, running }) => [id, running])),
  descendantCount: rows.length - 1,
  isMission: rows[0]?.parentId === null,
  runningCount: rows.filter((row) => row.running === 1).length,
});

/** The exact subtree and live turns the owner's one deletion confirmation covers. */
export const previewDeletion = (threadId: string) => readSubtree(threadId).pipe(Effect.map(previewOf));

type Subtree = Effect.Success<ReturnType<typeof readSubtree>>;

/** Marks the confirmed subtree as deleting and stops it; its turns are then cancelled. */
const markDeleting = Effect.fn("markDeleting")(function* (threadId: string, confirmation: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* readSubtree(threadId);
  if (previewOf(rows).confirmation !== confirmation) {
    return yield* new ServiceFailure({
      kind: "StaleVersion",
      message: "The threads changed. Review the deletion count again.",
    });
  }
  const ids = rows.map((row) => row.id);
  yield* sql`UPDATE threads SET is_deleting = 1 WHERE id IN ${sql.in(ids)}`;
  yield* haltThreads(ids, "Stopped");
  return changed(rows, { turnsToCancel: ids });
});

/** Erases the subtree's records; beneath a mission, the freed running slots then wake its waiting threads. */
const eraseSubtree = Effect.fn("eraseSubtree")(function* (rows: Subtree, root: Subtree[number]) {
  const sql = yield* SqlClient.SqlClient;
  const ids = rows.map((row) => row.id);
  // A received message belongs to its receiver's history, even after its sender is deleted.
  yield* sql`UPDATE messages SET sender_thread_id = NULL WHERE sender_thread_id IN ${sql.in(ids)}`;
  yield* forgetOutcomesOf(ids);
  yield* sql`DELETE FROM messages WHERE thread_id IN ${sql.in(ids)}`;
  yield* sql`DELETE FROM chatter WHERE first_id IN ${sql.in(ids)} OR second_id IN ${sql.in(ids)}`;
  yield* releaseResolvedChatter;
  yield* sql`DELETE FROM questions WHERE thread_id IN ${sql.in(ids)}`;
  yield* sql`DELETE FROM thread_activities WHERE thread_id IN ${sql.in(ids)}`;
  yield* sql`DELETE FROM suggestions WHERE thread_id IN ${sql.in(ids)}`;
  yield* sql`DELETE FROM handovers WHERE thread_id IN ${sql.in(ids)}`;
  yield* eraseThreadsLore(ids);
  // Usage stays: deleting never gives spending back to a budget (budget-control).
  yield* sql`DELETE FROM turns WHERE thread_id IN ${sql.in(ids)}`;
  if (root.parentId === null) {
    // Before the threads go: the top thread marked as deleting is what lets the entries go (store.ts, 0011).
    yield* sql`DELETE FROM journal_entries WHERE mission_id = ${root.missionId}`;
    yield* sql`DELETE FROM journals WHERE mission_id = ${root.missionId}`;
  }
  for (const row of rows.toReversed()) yield* sql`DELETE FROM threads WHERE id = ${row.id}`;
  if (root.parentId === null) {
    yield* sql`DELETE FROM rituals WHERE mission_id = ${root.missionId}`;
    yield* sql`DELETE FROM standing_permissions WHERE mission_id = ${root.missionId}`;
    yield* sql`DELETE FROM budget_events WHERE mission_id = ${root.missionId}`;
    yield* sql`DELETE FROM budget_stops WHERE mission_id = ${root.missionId}`;
    yield* sql`DELETE FROM missions WHERE id = ${root.missionId}`;
    return changed(null);
  }
  return changed(null, { missionsToWake: [root.missionId] });
});

/** Puts a subtree whose erasing failed back as it was, so the owner sees it and can delete it again. */
const restoreAfterFailure = Effect.fn("restoreAfterFailure")(function* (ids: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET is_deleting = 0 WHERE id IN ${sql.in(ids)}`;
  return changed(null);
});

/**
 * Permanently erases the confirmed subtree after invalidating and cancelling all its turns. The records go in one
 * transaction; the files and the scratch folder go only once it has committed, so a failure leaves records and files
 * together, and the subtree is no longer marked as deleting.
 */
export const deleteThread = Effect.fn("deleteThread")(function* (threadId: string, confirmation: string) {
  const commands = yield* Commands;
  const rows = yield* commands.run(markDeleting(threadId, confirmation));
  const root = rows[0];
  if (root === undefined) return yield* invalid("No thread to delete.");
  const ids = rows.map((row) => row.id);
  const files = yield* commands
    .run(
      forgetAttachmentsOf(ids).pipe(
        Effect.flatMap((files) => eraseSubtree(rows, root).pipe(Effect.map((done) => withFiles(done, files, root)))),
      ),
    )
    .pipe(Effect.onError(() => commands.run(restoreAfterFailure(ids)).pipe(Effect.orDie)));
  yield* removeAttachmentFiles(files);
  return null;
});

/** The erasing's result carrying the files to remove, and a quest's scratch folder to remove once it commits. */
const withFiles = (
  done: WithFollowUps<null>,
  files: ReadonlyArray<string>,
  root: Subtree[number],
): WithFollowUps<ReadonlyArray<string>> => ({
  followUps: root.parentId === null ? { ...done.followUps, missionsToRemoveScratch: [root.missionId] } : done.followUps,
  value: files,
});

/** Erases a quest already checked empty by the ending policy, in that policy's transaction. */
export const eraseEmptyQuest = Effect.fn("eraseEmptyQuest")(function* (threadId: string) {
  const rows = yield* readSubtree(threadId);
  const root = rows[0];
  if (root === undefined || root.parentId !== null) return yield* invalid("No quest to delete.");
  const marked = yield* markDeleting(threadId, previewOf(rows).confirmation);
  // Empty quests have no messages, hence no message-owned attachments; unassigned drafts belong to no quest.
  yield* eraseSubtree(rows, root);
  return changed(null, { missionsToRemoveScratch: [root.missionId], turnsToCancel: marked.followUps.turnsToCancel });
});
