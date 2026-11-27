import {
  type HarnessName,
  type MissionEnding,
  MissionId,
  type MissionPrompt,
  type MissionSummary,
  type ModelChoice,
  RitualId,
  ThreadId,
  WorkspaceId,
} from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient, type Statement } from "effect/sql";
import { consumptionColumns, costSum, tokenSum } from "../core/index.ts";
import { consumptionOf } from "./consumption.ts";
import { emptyQuestCondition } from "./emptyQuest.ts";
import { lastSampleOf, replyCountOf } from "./exchangeSamples.ts";
import { questStateOf, threadStatesOf } from "./missionStates.ts";
import {
  isNotArchivedErrandOf,
  isNotBeingDeletedOf,
  isVisibleQuestOf,
  unarchivedStandings,
} from "./questVisibility.ts";
import { runStateOf, scheduleOf } from "./ritualSchedule.ts";

// The quest lists the owner sees: each quest's summary, its state, and what it has used so far.

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
  replyCount: number;
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
    replyCount: row.replyCount,
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
        AND ${isNotArchivedErrandOf(sql)}) AS otherStates,
      (SELECT COUNT(*) FROM threads t WHERE t.mission_id = m.id AND ${isNotArchivedErrandOf(sql)}) AS threadCount,
      ${sql.literal(emptyQuestCondition("m.id"))} AS isEmpty,
      m.ending, m.is_title_by_user AS isTitleByUser, m.is_asking_done AS isAskingDone,
      ${sql.literal(consumptionColumns)},
      m.budget_cost AS budgetCost, m.budget_tokens AS budgetTokens, COALESCE(SUM(${sql.literal(costSum)}), 0) AS spentCost,
      COALESCE(SUM(${sql.literal(tokenSum)}), 0) AS spentTokens,
      w.id AS workspaceId, w.name AS workspaceName,
      ${sql.literal(lastSampleOf("top.id", "user"))} AS lastOwnerText, ${sql.literal(lastSampleOf("top.id", "agent"))} AS lastReplyText,
      ${sql.literal(replyCountOf("top"))} AS replyCount,
      r.id AS ritualId, r.is_on AS ritualIsOn, r.last_run_at AS ritualLastRunAt, r.last_run_state AS ritualLastRunState,
      r.next_run_at AS ritualNextRunAt, r.origin_mission_id AS ritualOriginMissionId,
      r.schedule AS ritualSchedule, top.state AS topState,
      (SELECT e.state FROM threads e WHERE e.parent_id = m.top_thread_id AND ${isNotBeingDeletedOf(sql, "e")}
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
export const listViewSummaries = Effect.fnUntraced(function* (isArchived: boolean, shouldIncludeRituals = false) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* missionRowsOf(sql, isVisibleQuestOf(sql, isArchived ? ["archived"] : unarchivedStandings));
  return rows.filter((row) => shouldIncludeRituals || row.ritualId === null).map(summaryOf);
});
