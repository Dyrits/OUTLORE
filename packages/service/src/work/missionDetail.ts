import type { Message, MissionDetail, ThreadSummary } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "../core/index.ts";
import { listThreadLoreChanges, readGauge } from "../lore/index.ts";
import { listThreadQuestions } from "../policy/index.ts";
import { ownAccountLabelOf } from "../remote/index.ts";
import { listThreadActivities } from "./activities.ts";
import { readCards } from "./attachments.ts";
import { listBudgetEvents, readHeldStop } from "./budgetViews.ts";
import { readChatter } from "./chatter.ts";
import { listHandovers } from "./handover.ts";
import { threadActionsOf } from "./lifecycle.ts";
import { listMissionSummaries } from "./missions.ts";
import { readOwnCopy } from "./ownCopies.ts";
import { listThreadSuggestions } from "./suggestionStore.ts";
import { readThreadWorkspace } from "./workspaces.ts";

// What the owner reads of one mission: its thread tree and one thread's conversation.

type ThreadRow = Omit<ThreadSummary, "isOpenedByAgent" | "isAside" | "isYourTurn" | "isArchived"> & {
  isArchived: number;
  isOpenedByAgent: number;
  isAside: number;
  isYourTurn: number;
};

/** The mission's threads with their depth and kept messages, each parent before the threads beneath it. */
const listThreads = Effect.fnUntraced(function* (missionId: string, topThreadId: string, includeArchived: boolean) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<ThreadRow & { path: string }>`
      WITH RECURSIVE tree(id, depth, path) AS (
        SELECT id, 0, '' FROM threads WHERE id = ${topThreadId}
        UNION ALL
        SELECT t.id, tree.depth + 1, tree.path || printf('%020d', t.rowid) || '/'
        FROM threads t JOIN tree ON t.parent_id = tree.id
      )
      SELECT t.id, t.parent_id AS parentId, t.title, t.state, tree.depth, tree.path,
        (t.archived_at IS NOT NULL) AS isArchived, t.is_opened_by_agent AS isOpenedByAgent, t.is_aside AS isAside,
        (t.state = 'Idle' AND (SELECT status FROM turns WHERE thread_id = t.id ORDER BY started_at DESC, rowid DESC LIMIT 1)
          = 'completed') AS isYourTurn,
        (SELECT COALESCE(MIN(m.sent_at), 0) FROM messages m WHERE m.thread_id = t.id) AS openedAt,
        (SELECT COALESCE(MAX(m.sent_at), 0) FROM messages m WHERE m.thread_id = t.id) AS lastActivityAt,
        t.harness, t.model,
        (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.sender_kind IN ('user', 'thread')
          AND m.delivered_turn_id IS NULL) AS waitingCount
      FROM tree JOIN threads t ON t.id = tree.id
      WHERE t.mission_id = ${missionId} AND (${includeArchived ? 1 : 0} = 1 OR t.archived_at IS NULL)
      ORDER BY tree.path`;
  return rows.map(({ path: _path, ...row }) => ({
    ...row,
    isArchived: row.isArchived === 1,
    isAside: row.isAside === 1,
    isOpenedByAgent: row.isOpenedByAgent === 1,
    isYourTurn: row.isYourTurn === 1,
  }));
});

/** An account's label: the computer's own sign-in reads as the computer's name, and an account removed since says so. */
const accountLabelOf = (accountId: string | null, label: string | null, computerName: string) =>
  accountId === null ? computerName : (label ?? "Removed account");

/** A mission's thread tree alone, for the views that show only where its threads stand. */
export const readThreadTree = Effect.fnUntraced(function* (missionId: string) {
  const [summary] = yield* listMissionSummaries([missionId]);
  if (summary === undefined) return yield* notFound("No such mission.");
  return yield* listThreads(missionId, summary.topThreadId, false);
});

/** A mission with its thread tree and the conversation of one thread, the top thread by default. */
export const readMission = Effect.fnUntraced(function* (missionId: string, threadId: string | null) {
  const sql = yield* SqlClient.SqlClient;
  const [summary] = yield* listMissionSummaries([missionId]);
  if (summary === undefined) return yield* notFound("No such mission.");
  const threads = yield* listThreads(missionId, summary.topThreadId, true);
  const selected = threads.find((thread) => thread.id === (threadId ?? summary.topThreadId));
  if (selected === undefined) return yield* notFound("No such thread in this mission.");
  const [thread] = yield* sql<
    Pick<MissionDetail["thread"], "id" | "model" | "effort" | "failure" | "blocker" | "harness" | "accountId"> & {
      accountLabel: string | null;
    }
  >`SELECT t.id, t.model, t.effort, t.failure, t.blocker, t.harness, t.account_id AS accountId, a.label AS accountLabel
      FROM threads t LEFT JOIN accounts a ON a.id = t.account_id WHERE t.id = ${selected.id}`;
  if (thread === undefined) return yield* notFound("No such thread in this mission.");
  const computerName = yield* ownAccountLabelOf(thread.harness);
  const workspace = yield* readThreadWorkspace(selected.id);
  const ownCopy = yield* readOwnCopy(selected.id);
  const messages = yield* sql<
    Omit<Message, "attachments" | "isResult" | "isQueued" | "isDelivered" | "usage"> & {
      isResult: number;
      isDelivered: number;
      isQueued: number;
      usageCacheCreation: number | null;
      usageCacheRead: number | null;
      usageEstimate: number | null;
      usageInput: number | null;
      usageOutput: number | null;
      usageReported: number | null;
    }
  >`
      SELECT m.id, m.thread_id AS threadId, m.sender_kind AS sender, m.model, m.harness, m.text, m.sequence, m.sent_at AS sentAt,
        m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle, m.is_result AS isResult,
        CASE WHEN sm.is_guildmaster = 0 THEN s.mission_id END AS fromMissionId,
        (m.is_queued = 1 AND m.delivered_turn_id IS NULL) AS isQueued, (m.delivered_turn_id IS NOT NULL) AS isDelivered,
        ru.input AS usageInput, ru.output AS usageOutput, ru.cache_read AS usageCacheRead,
        ru.cache_creation AS usageCacheCreation, ru.estimate AS usageEstimate, ru.reported AS usageReported
      FROM messages m LEFT JOIN reply_usage ru ON ru.message_id = m.id LEFT JOIN threads s ON s.id = m.sender_thread_id LEFT JOIN missions sm ON sm.id = s.mission_id
      WHERE m.thread_id = ${selected.id} ORDER BY m.sequence`;
  const cards = yield* readCards(messages.map((message) => message.id));
  const questions = yield* listThreadQuestions(selected.id);
  const suggestions = yield* listThreadSuggestions(selected.id);
  return {
    activities: yield* listThreadActivities(selected.id),
    budgetEvents: selected.parentId === null ? yield* listBudgetEvents(missionId) : [],
    budgetStop: yield* readHeldStop(selected.id),
    chatter: yield* readChatter(selected.id),
    handovers: yield* listHandovers(selected.id),
    loreChanges: yield* listThreadLoreChanges(selected.id),
    loreGauge: yield* readGauge(selected.id),
    messages: messages.map(
      ({ usageCacheCreation, usageCacheRead, usageEstimate, usageInput, usageOutput, usageReported, ...message }) => ({
        ...message,
        attachments: cards.get(message.id) ?? [],
        isDelivered: message.isDelivered === 1,
        isQueued: message.isQueued === 1,
        isResult: message.isResult === 1,
        usage:
          usageInput === null
            ? null
            : {
                estimated: usageEstimate,
                reported: usageReported,
                tokens: {
                  cacheCreation: usageCacheCreation ?? 0,
                  cacheRead: usageCacheRead ?? 0,
                  input: usageInput,
                  output: usageOutput ?? 0,
                },
              },
      }),
    ),
    mission: summary,
    questions,
    suggestions,
    thread: {
      ...thread,
      accountLabel: accountLabelOf(thread.accountId, thread.accountLabel, computerName),
      actions: threadActionsOf({ blocker: thread.blocker, depth: selected.depth, state: selected.state }),
      depth: selected.depth,
      ownCopy: ownCopy === null ? null : { branch: ownCopy.branch, path: ownCopy.path },
      parentId: selected.parentId,
      state: selected.state,
      title: selected.title,
      waitingCount: selected.waitingCount,
      workspace,
    },
    threads,
  };
});
