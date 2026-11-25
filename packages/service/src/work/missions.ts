import { type EffortChoice, MissionId, type ModelChoice, type StartChoices, ThreadId } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, isReached, newId, readGlobalBudget, readSettings, saveStartChoices } from "../core/index.ts";
import { checkAccount, type RunnerChoice, runnerOf } from "../harness/index.ts";
import { applyDefaultBudget } from "./budgetChanges.ts";
import { budgetRefusalOf } from "./budgetScopes.ts";
import { insertJournal } from "./journal.ts";
import { insertMessage } from "./messaging.ts";
import { requireActiveRealm } from "./realmAccess.ts";
import { readRealmPermissionMode } from "./threadPermissionMode.ts";
import { newQuestTitle } from "./titles.ts";
import { attachWorkspace } from "./workspaces.ts";

/**
 * Records the mission, its top thread in the chosen workspace or none, and the first message.
 * Callers run it in a transaction.
 */
export const insertMission = Effect.fnUntraced(function* (
  text: string,
  choice: RunnerChoice & { readonly effort: EffortChoice; readonly model: ModelChoice },
  workspacePath: string | null,
  shouldRememberChoices = true,
  realm: { name: string } | null = null,
  attachmentIds: ReadonlyArray<string> = [],
  realmId?: string | null,
) {
  const started = yield* insertQuest(
    {
      attachmentIds,
      firstMessage: text,
      realm,
      ...(realmId === undefined ? {} : { realmId }),
      shouldInheritRealmPermissions: true,
      shouldRememberChoices,
      title: newQuestTitle,
    },
    choice,
    workspacePath,
  );
  if (started.messageId === null) return yield* Effect.die("A mission started with text recorded no first message.");
  return {
    messageId: started.messageId,
    missionId: MissionId.make(started.missionId),
    threadId: ThreadId.make(started.threadId),
    threadsToWake: started.threadsToWake,
  };
});

/**
 * Records a quest, its top thread, and its first message when it has one; a Ritual's quest has none until its first run
 * (rituals). A title given by `isTitleByOwner` is kept against agents' renames. Callers run it in a transaction.
 */
export const insertQuest = Effect.fnUntraced(function* (
  quest: {
    /** The files attached to the first message, added beforehand as drafts (message-attachments). */
    readonly attachmentIds?: ReadonlyArray<string>;
    readonly firstMessage: string | null;
    /**
     * The realm to place the quest in, by id, instead of by `workspacePath`; it must exist. A realm tied to no folder
     * gives the quest its lore and no folder to work in. Null with a null path places the quest in the Borderlands.
     */
    readonly realmId?: string | null;
    readonly isChannel?: boolean;
    readonly isTitleByOwner?: boolean;
    readonly realm: { name: string } | null;
    readonly shouldInheritRealmPermissions?: boolean;
    readonly shouldRememberChoices: boolean;
    readonly title: string;
  },
  choice: RunnerChoice & { readonly effort: EffortChoice; readonly model: ModelChoice },
  workspacePath: string | null,
) {
  const { realm, shouldRememberChoices } = quest;
  const sql = yield* SqlClient.SqlClient;
  const global = yield* readGlobalBudget;
  // A reached global budget refuses new missions (budget-control, Reaching a limit).
  if (quest.isChannel !== true && isReached(global.limits, global.spent))
    return yield* invalid("The global budget is reached. Raise it in the Workshop to start a mission.");
  const settings = yield* readSettings;
  const runner = yield* checkAccount(
    runnerOf({ accountId: null, effort: choice.effort, harness: settings.defaultHarness, model: choice.model }, choice),
  );
  const { accountId, effort, harness, model } = runner;
  // A reached account budget refuses a quest started on that account (budget-control, Reaching a limit).
  const accountBudgetRefusal = yield* budgetRefusalOf(null, { accountId, harness }, "Account");
  if (quest.isChannel !== true && accountBudgetRefusal !== null) return yield* invalid(accountBudgetRefusal);
  const realmId = quest.realmId ?? null;
  if (realmId !== null) {
    yield* requireActiveRealm(realmId);
  }
  const workspaceId =
    realmId !== null ? realmId : workspacePath === null ? null : yield* attachWorkspace(workspacePath, realm);
  const permissionMode =
    quest.shouldInheritRealmPermissions === true && workspaceId !== null
      ? yield* readRealmPermissionMode(workspaceId)
      : null;
  const now = yield* Clock.currentTimeMillis;
  const missionId = yield* newId;
  const threadId = yield* newId;
  yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at, is_title_by_user)
      VALUES (${missionId}, ${threadId}, ${quest.title}, ${now}, ${now}, ${quest.isTitleByOwner === true ? 1 : 0})`;
  // The Charter's backup Companions are the new thread's own from the start (thread-panel, Backup companions).
  yield* sql`INSERT INTO threads (id, mission_id, state, harness, account_id, model, effort, workspace_id, title, backups, permission_mode)
      VALUES (${threadId}, ${missionId}, 'Resting', ${harness}, ${accountId}, ${model}, ${effort}, ${workspaceId}, ${quest.title}, ${JSON.stringify(settings.backups)}, ${permissionMode})`;
  const opening =
    quest.firstMessage === null
      ? null
      : yield* insertMessage({
          fromThreadId: null,
          isQueued: false,
          isResult: false,
          text: quest.firstMessage,
          threadId,
          ...(quest.attachmentIds === undefined ? {} : { attachmentIds: quest.attachmentIds }),
        });
  yield* insertJournal(missionId);
  yield* applyDefaultBudget(missionId, settings.defaultMissionBudget);
  // A mission opened from an off-topic suggestion is not the owner's own start, so the prefill stays.
  if (shouldRememberChoices)
    yield* saveStartChoices({
      accountId: accountId as StartChoices["accountId"],
      effort,
      harness,
      model,
      workspacePath,
    });
  return { messageId: opening?.messageId ?? null, missionId, threadId, threadsToWake: opening?.threadsToWake ?? [] };
});
