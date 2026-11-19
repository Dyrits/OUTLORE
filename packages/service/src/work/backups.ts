import { BackupCompanion } from "@outlore/contracts";
import { Effect, Exit, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { notFound, readSettings } from "../core/index.ts";
import { checkBackups } from "../harness/index.ts";
import { refuseWaitingImages } from "./admission.ts";
import { changed, unchanged, type WithFollowUps } from "./followUps.ts";
import { changeThreadRunner } from "./handover.ts";

// Backup Companions (thread-panel, Backups): the Companions a thread falls back to, in order, when a turn fails.

const decodeBackups = Schema.decodeUnknownSync(Schema.Array(BackupCompanion));

/** Saves a thread's backups; the failure chain starts over. Each account must exist and belong to its harness. */
export const setThreadBackups = Effect.fnUntraced(function* (
  threadId: string,
  backups: ReadonlyArray<BackupCompanion>,
) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ id: string }>`SELECT id FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
  if (thread === undefined) return yield* notFound("No such thread.");
  yield* checkBackups(backups);
  yield* sql`UPDATE threads SET backups = ${JSON.stringify(backups)}, backup_step = 0 WHERE id = ${threadId}`;
  return changed(null);
});

/** Saves the backups a card named for the quest it opened, a refusal rolling back the quest too; a card naming none, or the Workshop's own default list, leaves the list the quest started with. */
export const setCardBackups = Effect.fnUntraced(function* (
  threadId: string | null,
  backups: ReadonlyArray<BackupCompanion> | undefined,
) {
  const { backups: defaults } = yield* readSettings;
  if (threadId === null || backups === undefined || JSON.stringify(backups) === JSON.stringify(defaults)) return;
  yield* setThreadBackups(threadId, backups);
});

/** The failure chain starts over: a turn completed, or the owner chose a runner. */
export const resetBackupStep = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET backup_step = 0 WHERE id = ${threadId} AND backup_step != 0`;
});

/**
 * A turn of the thread failed: the thread carries on with the next backup that differs from its current runner, the
 * conversation handed over to it (the line says why). Nothing happens when the list is used up. A backup that cannot be
 * taken, such as one on a removed account, is passed over. With `isOtherAccountRequired`, a backup that runs on the
 * thread's own harness and account is passed over too (budget-control, Switching at an account's budget): it would
 * be held by the same budget again.
 */
export const fallBackToBackup = Effect.fnUntraced(function* (
  threadId: string,
  reason: string,
  { isOtherAccountRequired = false }: { isOtherAccountRequired?: boolean } = {},
) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ accountId: string | null; backups: string; harness: string; step: number }>`
      SELECT backups, backup_step AS step, harness, account_id AS accountId
      FROM threads WHERE id = ${threadId} AND is_deleting = 0`;
  if (row === undefined) return unchanged(null);
  const backups = decodeBackups(JSON.parse(row.backups));
  for (let index = row.step; index < backups.length; index++) {
    const candidate = backups[index];
    if (candidate === undefined) continue;
    if (isOtherAccountRequired && candidate.harness === row.harness && candidate.accountId === row.accountId) continue;
    const outcome = yield* Effect.exit(
      refuseWaitingImages(threadId, candidate).pipe(
        Effect.andThen(changeThreadRunner(threadId, candidate, { fellBackAfter: reason })),
      ),
    );
    if (!Exit.isSuccess(outcome) || !outcome.value.followUps.isChanged) continue;
    yield* sql`UPDATE threads SET backup_step = ${index + 1} WHERE id = ${threadId}`;
    return { followUps: outcome.value.followUps, value: null } satisfies WithFollowUps<null>;
  }
  return unchanged(null);
});
