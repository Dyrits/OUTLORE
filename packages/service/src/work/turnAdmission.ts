import type { EffortChoice, HarnessName, ModelChoice, ThreadPermissionMode } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, newId, readSettings, touchMission } from "../core/index.ts";
import type { StoredAttachment } from "./attachments.ts";
import { holdIfReached } from "./budgets.ts";
import { recordPendingHandover } from "./handover.ts";
import { holdThread, startRunning } from "./lifecycle.ts";
import { readOwnCopy } from "./ownCopies.ts";
import { deliverMessages, listPending } from "./pendingMessages.ts";
import { isQuestRealmArchived } from "./realmAccess.ts";
import { effectiveModeOf } from "./threadPermissionMode.ts";
import { maxRunning, runningCountOf } from "./treeLimits.ts";
import { readThreadWorkspace } from "./workspaces.ts";

/** A turn admitted with the runner and messages whose execution it owns. */
export type Admitted = {
  readonly accountId: string | null;
  readonly attachments: ReadonlyArray<StoredAttachment>;
  readonly effort: EffortChoice;
  readonly harness: HarnessName;
  /** Whether the turn has no message: the harness woke itself, and its work is run and recorded as a turn. */
  readonly isBackgroundWake: boolean;
  readonly messages: ReadonlyArray<string>;
  readonly missionId: string;
  readonly model: ModelChoice;
  readonly sessionId: string | null;
  readonly turnId: string;
};

/** Whether output still belongs to this thread's current running turn. */
export const isCurrentTurn = Effect.fnUntraced(function* (turnId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`SELECT id FROM turns WHERE id = ${turnId} AND status = 'running'`;
  return rows.length > 0;
});

/**
 * The harness whose permission authority applies to the thread now: its running turn's admitted harness, or the
 * thread's selected harness between turns (thread-handover). Null for a thread that does not exist.
 */
export const readAuthorityHarness = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ harness: HarnessName }>`SELECT COALESCE(
      (SELECT turns.harness FROM turns WHERE turns.thread_id = threads.id AND turns.status = 'running'
        ORDER BY turns.started_at DESC, turns.rowid DESC LIMIT 1),
      threads.harness) AS harness
    FROM threads WHERE threads.id = ${threadId}`;
  return row?.harness ?? null;
});

/** The thread's running turn, the latest when several run, or null between turns. */
export const readRunningTurnId = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [turn] = yield* sql<{ id: string }>`SELECT id FROM turns
    WHERE thread_id = ${threadId} AND status = 'running' ORDER BY started_at DESC, rowid DESC LIMIT 1`;
  return turn?.id ?? null;
});

/**
 * Admits pending messages only when the thread, realm, workspace, budget, and running limit permit work. A background wake
 * is admitted under the same limits with no message: its harness began work on its own, such as Claude Code when a
 * background command ended, and messages that wait are left for the turn after it.
 */
const admit = Effect.fnUntraced(function* (threadId: string, isBackgroundWake: boolean) {
  const sql = yield* SqlClient.SqlClient;
  const changes = yield* Changes;
  const [thread] = yield* sql<{
    state: string;
    missionId: string;
    sessionId: string | null;
    model: ModelChoice;
    effort: EffortChoice;
    harness: HarnessName;
    accountId: string | null;
    permissionMode: ThreadPermissionMode | null;
  }>`SELECT t.state, t.mission_id AS missionId, t.session_id AS sessionId, t.model, t.effort, t.harness,
            t.account_id AS accountId, t.permission_mode AS permissionMode FROM threads t JOIN missions m ON m.id = t.mission_id
          WHERE t.id = ${threadId} AND t.archived_at IS NULL AND t.is_deleting = 0
            AND (${!isBackgroundWake} OR m.ending IS NULL)`;
  // Attention can hold a turn still running in its harness; Stopped always needs an explicit resume.
  if (thread === undefined || ["Underway", "Attention", "Stopped"].includes(thread.state)) return null;
  if (yield* isQuestRealmArchived(thread.missionId)) return null;
  const pending = yield* listPending(threadId, false);
  if (pending.length === 0 && !isBackgroundWake) return null;
  if ((yield* runningCountOf(thread.missionId)) >= maxRunning) return null;
  const now = yield* Clock.currentTimeMillis;
  const workspace = yield* readThreadWorkspace(threadId);
  // A deleted own copy holds the thread as a missing workspace does (workspace-attachment, CHG-0441).
  if (workspace?.isMissing === true || (yield* readOwnCopy(threadId))?.isMissing === true) {
    yield* holdThread(threadId, "MissingWorkspace");
    yield* touchMission(thread.missionId, now);
    yield* sql.afterCommit(changes.publish);
    return null;
  }
  if (yield* holdIfReached(threadId, thread.missionId)) {
    yield* touchMission(thread.missionId, now);
    yield* sql.afterCommit(changes.publish);
    return null;
  }
  // A runner change is recorded when it actually runs, not while messages wait for admission.
  if (!isBackgroundWake) yield* recordPendingHandover(threadId, now);
  const turnId = yield* newId;
  // A turn runs under the mode it is admitted with: a change during the turn applies from the next one (CHG-0617).
  const mode = effectiveModeOf(thread.permissionMode, (yield* readSettings).defaultPermissionMode);
  yield* sql`INSERT INTO turns (id, thread_id, status, started_at, harness, model, permission_mode)
          VALUES (${turnId}, ${threadId}, 'running', ${now}, ${thread.harness}, ${thread.model}, ${mode})`;
  const taken = isBackgroundWake ? [] : pending;
  yield* deliverMessages(
    taken.map((message) => message.id),
    turnId,
  );
  yield* startRunning(threadId);
  yield* touchMission(thread.missionId, now);
  yield* sql.afterCommit(changes.publish);
  return {
    accountId: thread.accountId,
    attachments: taken.flatMap((message) => message.attachments),
    effort: thread.effort,
    harness: thread.harness,
    isBackgroundWake,
    messages: taken.map((message) => message.text),
    missionId: thread.missionId,
    model: thread.model,
    sessionId: thread.sessionId,
    turnId,
  } satisfies Admitted;
});

/** Admits the pending inbox messages in one transaction. */
export const admitTurn = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql.withTransaction(admit(threadId, false));
});

/** The running turn can take the wake, or admission starts a turn for it. Null allows the pool to close. */
export const admitBackgroundWake = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      if ((yield* readRunningTurnId(threadId)) !== null) return "taken";
      return yield* admit(threadId, true);
    }),
  );
});
