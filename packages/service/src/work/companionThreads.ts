import type { HarnessName } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { newId, notFound } from "../core/index.ts";
import { harnessLabels } from "../harness/index.ts";
import { listThreadQuestions } from "../policy/index.ts";
import { ownAccountLabelOf } from "../remote/index.ts";
import { isNotBeingDeletedOf } from "./questVisibility.ts";

// The thread a Companion answers in (thread-messaging, Mentioning a Companion with @; CHG-0781): the top thread of a hidden
// quest of its own, found per conversation and model, so turns, approvals, the tool server and the process pool apply to it
// unchanged and nothing of the conversation's own thread is shared. It works where the conversation does.

/** Which Companion: a harness, an account (null for the harness's own sign-in), and a model. */
export type CompanionKey = {
  readonly accountId: string | null;
  readonly harness: HarnessName;
  readonly model: string;
};

/** A Companion's thread, with what its replies are labelled with. */
export type CompanionThread = CompanionKey & {
  readonly accountLabel: string;
  readonly missionId: string;
  readonly parentThreadId: string;
  readonly threadId: string;
};

/** The account as the owner reads it: the added account's label, or the harness's own sign-in's. */
export const accountLabelOfCompanion = Effect.fnUntraced(function* (harness: HarnessName, accountId: string | null) {
  const sql = yield* SqlClient.SqlClient;
  if (accountId === null) return yield* ownAccountLabelOf(harness);
  const [row] = yield* sql<{ label: string }>`SELECT label FROM accounts WHERE id = ${accountId}`;
  return row?.label ?? harnessLabels[harness];
});

/** What a Companion thread is called: its model, then its account. */
const titleOf = (key: CompanionKey, accountLabel: string) => `${key.model} · ${accountLabel}`;

/**
 * The Companion's thread for the conversation: made once, then found again, so a second mention of the model resumes the
 * same session. It takes the conversation's folder, own copy and permission mode as they are now, each time. Callers run
 * it in a transaction.
 */
export const ensureCompanionThread = Effect.fnUntraced(function* (parentThreadId: string, key: CompanionKey) {
  const sql = yield* SqlClient.SqlClient;
  const [parent] = yield* sql<{
    ownCopy: string | null;
    ownCopyBranch: string | null;
    permissionMode: string | null;
    workspaceId: string | null;
  }>`SELECT workspace_id AS workspaceId, permission_mode AS permissionMode, own_copy AS ownCopy,
        own_copy_branch AS ownCopyBranch FROM threads WHERE id = ${parentThreadId} AND ${isNotBeingDeletedOf(sql, "threads")}`;
  if (parent === undefined) return yield* notFound("No such thread.");
  const accountKey = key.accountId ?? "-";
  const accountLabel = yield* accountLabelOfCompanion(key.harness, key.accountId);
  const [existing] = yield* sql<{ missionId: string; threadId: string }>`
    SELECT thread_id AS threadId, mission_id AS missionId FROM companion_threads
    WHERE parent_thread_id = ${parentThreadId} AND harness = ${key.harness} AND account_key = ${accountKey}
      AND model = ${key.model}`;
  if (existing !== undefined) {
    yield* sql`UPDATE threads SET workspace_id = ${parent.workspaceId}, permission_mode = ${parent.permissionMode},
        own_copy = ${parent.ownCopy}, own_copy_branch = ${parent.ownCopyBranch}, title = ${titleOf(key, accountLabel)}
      WHERE id = ${existing.threadId}`;
    return { ...key, accountLabel, ...existing, parentThreadId } satisfies CompanionThread;
  }
  const now = yield* Clock.currentTimeMillis;
  const missionId = yield* newId;
  const threadId = yield* newId;
  const title = titleOf(key, accountLabel);
  yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at, is_title_by_user, is_companion)
      VALUES (${missionId}, ${threadId}, ${title}, ${now}, ${now}, 1, 1)`;
  // No backups: a Companion that cannot answer says so in the conversation, and the owner chooses another.
  yield* sql`INSERT INTO threads (id, mission_id, state, harness, account_id, model, effort, workspace_id, title, backups,
        permission_mode, own_copy, own_copy_branch)
      VALUES (${threadId}, ${missionId}, 'Resting', ${key.harness}, ${key.accountId}, ${key.model}, 'default',
        ${parent.workspaceId}, ${title}, '[]', ${parent.permissionMode}, ${parent.ownCopy}, ${parent.ownCopyBranch})`;
  yield* sql`INSERT INTO companion_threads (parent_thread_id, harness, account_key, model, thread_id, mission_id)
      VALUES (${parentThreadId}, ${key.harness}, ${accountKey}, ${key.model}, ${threadId}, ${missionId})`;
  return { ...key, accountLabel, missionId, parentThreadId, threadId } satisfies CompanionThread;
});

/** The Companion a thread is, with its conversation; null for any other thread. */
export const readCompanionOfThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{
    accountId: string | null;
    harness: HarnessName;
    missionId: string;
    model: string;
    parentThreadId: string;
  }>`SELECT c.parent_thread_id AS parentThreadId, c.mission_id AS missionId, t.harness, t.account_id AS accountId, t.model
      FROM companion_threads c JOIN threads t ON t.id = c.thread_id WHERE c.thread_id = ${threadId}`;
  if (row === undefined) return null;
  const accountLabel = yield* accountLabelOfCompanion(row.harness, row.accountId);
  return { ...row, accountLabel, threadId } satisfies CompanionThread;
});

/** The Companion threads of the conversations in `parentThreadIds`, for deleting them with their conversation. */
export const listCompanionThreadIds = Effect.fnUntraced(function* (parentThreadIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  if (parentThreadIds.length === 0) return [];
  const rows = yield* sql<{ threadId: string }>`
    SELECT thread_id AS threadId FROM companion_threads WHERE parent_thread_id IN ${sql.in(parentThreadIds)}`;
  return rows.map((row) => row.threadId);
});

/**
 * The questions the Companions asked in this conversation put to the owner, open and recorded, so the owner answers them
 * where they asked the Companion: the Companion's thread is hidden and shows none of its own.
 */
export const listCompanionQuestions = Effect.fnUntraced(function* (parentThreadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ threadId: string }>`
    SELECT thread_id AS threadId FROM companion_threads WHERE parent_thread_id = ${parentThreadId}`;
  const questions = yield* Effect.forEach(rows, (row) => listThreadQuestions(row.threadId));
  return questions.flat();
});
