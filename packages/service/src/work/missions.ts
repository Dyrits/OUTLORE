import {
  type EffortChoice,
  type HarnessName,
  type MissionEnding,
  MissionId,
  type MissionPrompt,
  type MissionSummary,
  type ModelChoice,
  RitualId,
  type StartChoices,
  ThreadId,
  WorkspaceId,
} from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import {
  consumptionColumns,
  costSum,
  invalid,
  isReached,
  newId,
  readGlobalBudget,
  readSettings,
  saveStartChoices,
  tokenSum,
} from "../core/index.ts";
import { checkAccount, type RunnerChoice, runnerOf } from "../harness/index.ts";
import { budgetRefusalOf } from "./budgetScopes.ts";
import { applyDefaultBudget } from "./budgets.ts";
import { consumptionOf } from "./consumption.ts";
import { emptyQuestCondition } from "./emptyQuest.ts";
import { lastSampleOf } from "./exchangeSamples.ts";
import { insertJournal } from "./journal.ts";
import { insertMessage } from "./messaging.ts";
import { questStateOf, threadStatesOf } from "./missionStates.ts";
import { requireActiveRealm } from "./realmAccess.ts";
import { runStateOf, scheduleOf } from "./ritualSchedule.ts";
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

type MissionRow = {
  id: string;
  title: string;
  topThreadId: string;
  harness: HarnessName;
  model: ModelChoice;
  lastActivityAt: number;
  otherStates: string | null;
  threadCount: number;
  ending: MissionEnding | null;
  isEmpty: number;
  isTitleByUser: number;
  isAskingDone: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
  reported: number;
  estimated: number;
  turns: number;
  unpricedTurns: number;
  earlierTurns: number;
  workspaceId: string | null;
  workspaceName: string | null;
  lastOwnerText: string | null;
  lastReplyText: string | null;
  budgetCost: number | null;
  budgetTokens: number | null;
  ritualId: string | null;
  ritualIsOn: number | null;
  ritualLastRunAt: number | null;
  ritualLastRunState: string | null;
  ritualNextRunAt: number | null;
  ritualOriginMissionId: string | null;
  ritualSchedule: string | null;
  /** The state of the latest run errand beneath the top thread, when one ran (rituals). */
  runThreadState: string | null;
  topState: string;
  spentCost: number;
  spentTokens: number;
};

/** What the dashboard asks of a mission not ended: Mark as done after its result. */
const promptOf = (row: MissionRow): MissionPrompt | null =>
  row.ending === null && row.isAskingDone === 1 ? "MarkDone" : null;

const summaryOf = (row: MissionRow): MissionSummary => {
  const otherStates = threadStatesOf(row.otherStates);
  const [topState = "Resting"] = threadStatesOf(row.topState);
  return {
    budget: {
      limits: { cost: row.budgetCost, tokens: row.budgetTokens },
      spent: { cost: row.spentCost, tokens: row.spentTokens },
    },
    consumption: consumptionOf(row),
    harness: row.harness,
    id: MissionId.make(row.id),
    isEmpty: row.isEmpty === 1,
    isTitleByUser: row.isTitleByUser === 1,
    lastActivityAt: row.lastActivityAt,
    lastExchange: { owner: row.lastOwnerText, reply: row.lastReplyText },
    model: row.model,
    prompt: promptOf(row),
    ritual:
      row.ritualId === null || row.ritualSchedule === null
        ? null
        : {
            id: RitualId.make(row.ritualId),
            isOn: row.ritualIsOn === 1,
            lastRunAt: row.ritualLastRunAt,
            // An unfinished run reads as interrupted when its errand was stopped (rituals).
            lastRunState: runStateOf(row.ritualLastRunState, row.runThreadState ?? "Resting"),
            nextRunAt: row.ritualNextRunAt,
            originMissionId: row.ritualOriginMissionId === null ? null : MissionId.make(row.ritualOriginMissionId),
            schedule: scheduleOf(row.ritualSchedule),
          },
    runningCount: [topState, ...otherStates].filter((state) => state === "Underway").length,
    state: row.ending ?? questStateOf(topState, otherStates, row.isEmpty === 1),
    threadCount: row.threadCount,
    title: row.title,
    topThreadId: ThreadId.make(row.topThreadId),
    usage: { cacheCreation: row.cacheCreation, cacheRead: row.cacheRead, input: row.input, output: row.output },
    workspaceId: row.workspaceId === null ? null : WorkspaceId.make(row.workspaceId),
    workspaceName: row.workspaceName,
  };
};

const missionRowsOf = (sql: SqlClient.SqlClient, where: Statement.Fragment) =>
  sql<MissionRow>`
    SELECT m.id, m.title, m.top_thread_id AS topThreadId, top.harness AS harness, top.model AS model, m.last_activity_at AS lastActivityAt,
      (SELECT group_concat(t.state) FROM threads t WHERE t.mission_id = m.id AND t.id != m.top_thread_id
        AND t.archived_at IS NULL) AS otherStates,
      (SELECT COUNT(*) FROM threads t WHERE t.mission_id = m.id AND t.archived_at IS NULL) AS threadCount,
      ${sql.literal(emptyQuestCondition("m.id"))} AS isEmpty,
      m.ending, m.is_title_by_user AS isTitleByUser, m.is_asking_done AS isAskingDone,
      ${sql.literal(consumptionColumns)},
      m.budget_cost AS budgetCost, m.budget_tokens AS budgetTokens, COALESCE(SUM(${sql.literal(costSum)}), 0) AS spentCost,
      COALESCE(SUM(${sql.literal(tokenSum)}), 0) AS spentTokens,
      w.id AS workspaceId, w.name AS workspaceName,
      ${sql.literal(lastSampleOf("top.id", "user"))} AS lastOwnerText, ${sql.literal(lastSampleOf("top.id", "agent"))} AS lastReplyText,
      r.id AS ritualId, r.is_on AS ritualIsOn, r.last_run_at AS ritualLastRunAt, r.last_run_state AS ritualLastRunState,
      r.next_run_at AS ritualNextRunAt, r.origin_mission_id AS ritualOriginMissionId,
      r.schedule AS ritualSchedule, top.state AS topState,
      (SELECT e.state FROM threads e WHERE e.parent_id = m.top_thread_id AND e.is_deleting = 0
        AND e.is_aside = 0 ORDER BY e.rowid DESC LIMIT 1) AS runThreadState
    FROM missions m
      JOIN threads top ON top.id = m.top_thread_id
      LEFT JOIN rituals r ON r.mission_id = m.id
      LEFT JOIN workspaces w ON w.id = top.workspace_id
      LEFT JOIN usage u ON u.mission_id = m.id
    WHERE ${where}
    GROUP BY m.id
    ORDER BY m.last_activity_at DESC`;

/** The current summary of each given mission, for missions offered elsewhere (thread-tree, Off-topic requests). */
export const listMissionSummaries = Effect.fnUntraced(function* (missionIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  if (missionIds.length === 0) return [];
  const rows = yield* missionRowsOf(sql, sql`m.id IN ${sql.in(missionIds)}`);
  return rows.map(summaryOf);
});

/**
 * The summaries of the Archived view's missions, or of the dashboard's: not ended, or Done. The realm's Rituals stay
 * out unless asked for, when they come with their ritual fields so the app draws them as ritual rows among the quests
 * (CHG-0616); the Guildmaster's own is in no list.
 */
export const listViewSummaries = Effect.fnUntraced(function* (isArchived: boolean, includeRituals = false) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* missionRowsOf(
    sql,
    isArchived
      ? sql`m.ending = 'Archived' AND m.is_guildmaster = 0`
      : sql`(m.ending IS NULL OR m.ending = 'Fulfilled') AND m.is_guildmaster = 0`,
  );
  return rows.filter((row) => includeRituals || row.ritualId === null).map(summaryOf);
});
