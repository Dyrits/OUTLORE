import type { TokenUsage } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { FileChange } from "../core/index.ts";
import { PriceTable, type TurnOutcome, touchMission } from "../core/index.ts";
import { readContextLimit } from "../lore/index.ts";
import { callDescriptionOf, saveActivityChange } from "./activities.ts";
import { fallBackToBackup, resetBackupStep } from "./backups.ts";
import { enforceBudgets } from "./budgets.ts";
import { answerExchanges, refuseExchanges, releaseContext } from "./companionExchanges.ts";
import { readCompanionOfThread } from "./companionThreads.ts";
import { readLatestContextUsed, recordContextReading } from "./contextReadings.ts";
import { contextLimitLineOf, hasReachedLimit } from "./contextWarning.ts";
import { changed, unchanged } from "./followUps.ts";
import { insertThreadLine, isRunnerChangedSince, isSessionOfThread } from "./handover.ts";
import { endTurn, failTurn } from "./lifecycle.ts";
import { insertReply } from "./messaging.ts";
import { deliverMessages, listThreadsWithPending } from "./pendingMessages.ts";
import { fallBackAfterFailure, finishRitualRun } from "./rituals.ts";
import { type Admitted, isCurrentTurn } from "./turnAdmission.ts";
import type { TurnScope } from "./turnScopes.ts";
import { attachTurnRemainder, estimateCost, modelOfTurn } from "./turnUsage.ts";
import { moveWorkingFolder } from "./workingFolders.ts";

// Turn operations return follow-ups; the command runner commits and applies them.

/** What a turn's events touch: the quest's conversation, activity and state, never the settings or what a screen shows of them. */
const workTopics = ["work"] as const;

/** Records a current turn's incremental event in the command's transaction. */
const recordStep = Effect.fnUntraced(function* <A, E, R>(turn: Admitted, step: Effect.Effect<A, E, R>) {
  if (!(yield* isCurrentTurn(turn.turnId))) return unchanged(null);
  yield* step;
  return changed(null, { topics: workTopics });
});

/**
 * Saves a reply of the running turn to the thread's conversation. A harness that names no model (Codex, OpenCode) leaves
 * the reply under the model the thread chose for this turn, so a later model switch does not relabel it.
 */
export const saveTurnReply = (
  threadId: string,
  turn: Admitted,
  text: string,
  model: string | null,
  usage: TokenUsage | null = null,
) =>
  recordStep(
    turn,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const [reported] = yield* sql<{ reportedTurnId: string | null }>`
        SELECT reported_turn_id AS reportedTurnId FROM threads WHERE id = ${threadId}`;
      if (reported?.reportedTurnId === turn.turnId) {
        const [latest] = yield* sql<{ text: string }>`
          SELECT text FROM messages WHERE thread_id = ${threadId} AND sender_kind = 'agent'
          ORDER BY sequence DESC LIMIT 1`;
        if (latest !== undefined && latest.text.trim() === text.trim()) return;
      }
      const written = model ?? (turn.model === "default" ? null : turn.model);
      const messageId = yield* insertReply(turn.missionId, threadId, text, { harness: turn.harness, model: written });
      // The call behind the reply, when the harness reports usage per call; the turn's remainder joins it at the turn's end.
      if (usage !== null) {
        const estimate = written === null ? null : yield* (yield* PriceTable).estimate(written, usage);
        yield* sql`INSERT INTO reply_usage (message_id, input, output, cache_read, cache_creation, estimate)
          VALUES (${messageId}, ${usage.input}, ${usage.output}, ${usage.cacheRead}, ${usage.cacheCreation}, ${estimate?.amount ?? null})`;
      }
    }),
  );

/** Records a tool call the harness reported as it started, a step of the running turn (action-approval). */
export const saveTurnActivity = (
  threadId: string,
  turn: Admitted,
  id: string,
  toolName: string,
  input: unknown,
  change: FileChange | null = null,
) =>
  recordStep(
    turn,
    Effect.gen(function* () {
      const described = callDescriptionOf(toolName, input);
      if (described === null) return;
      const sql = yield* SqlClient.SqlClient;
      const now = yield* Clock.currentTimeMillis;
      // The call's prompt may have come first and marked it; the mark stays.
      yield* sql`INSERT INTO thread_activities (id, thread_id, at, summary, detail)
        VALUES (${id}, ${threadId}, ${now}, ${described.summary}, ${described.detail})
        ON CONFLICT (thread_id, id) DO UPDATE SET at = excluded.at, summary = excluded.summary, detail = excluded.detail`;
      if (change !== null) yield* saveActivityChange(threadId, id, change);
    }),
  );

/** Records where a tool call of the running turn moved the thread's shell, for the terminal to start there. */
export const saveTurnFolderMove = (threadId: string, turn: Admitted, start: string, toolName: string, input: unknown) =>
  recordStep(turn, moveWorkingFolder(threadId, start, toolName, input));

/** Records a line the harness adapter left in the thread during the turn, such as a session it could not continue. */
export const saveTurnNotice = (threadId: string, turn: Admitted, text: string) =>
  recordStep(
    turn,
    Effect.gen(function* () {
      yield* insertThreadLine(threadId, text, yield* Clock.currentTimeMillis);
    }),
  );

/**
 * Ends a completed or interrupted turn (CHG-0039), with cancellation and wake follow-ups after its usage commits. The
 * thread's own state and session are written only when the run is the thread's main scope.
 */
export const completeTurn = Effect.fnUntraced(function* (
  threadId: string,
  turn: Admitted,
  outcome: TurnOutcome,
  scope: TurnScope,
) {
  const sql = yield* SqlClient.SqlClient;
  const prices = yield* PriceTable;
  if (!(yield* isCurrentTurn(turn.turnId))) return unchanged(null);
  const { billing, context, contextWindow, cost, isInterrupted, sessionId, usage } = outcome;
  const now = yield* Clock.currentTimeMillis;
  const used = context ?? null;
  const windowSize = contextWindow ?? null;
  const hasContext = used !== null || windowSize !== null;
  if (usage !== null || hasContext) {
    const model = yield* modelOfTurn(threadId, turn);
    const earlier = used === null ? null : yield* readLatestContextUsed(threadId);
    if (usage !== null) {
      const estimate = yield* estimateCost(prices, model, usage, billing, cost, now);
      yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, cost, context, context_window,
            billing, harness, model, account_id, estimate, estimate_source, priced_at)
          VALUES (${turn.turnId}, ${turn.missionId}, ${threadId}, ${now}, ${usage.input}, ${usage.output},
            ${usage.cacheRead}, ${usage.cacheCreation}, ${cost}, ${used}, ${windowSize}, ${billing},
            ${turn.harness}, ${model}, ${turn.accountId}, ${estimate?.amount ?? null}, ${estimate?.source ?? null}, ${estimate?.pricedAt ?? null})`;
      yield* attachTurnRemainder(threadId, turn, usage, {
        estimate: billing === "ApiKey" && cost !== null ? null : (estimate?.amount ?? null),
        reported: billing === "ApiKey" ? cost : null,
      });
    }
    if (hasContext)
      yield* recordContextReading({ model, recordedAt: now, size: windowSize, threadId, turnId: turn.turnId, used });
    // The context reached the limit this turn: one line says so, and offers the way to compact (not on each turn past it).
    if (used !== null) {
      const limit = yield* readContextLimit(turn.model, threadId);
      if (hasReachedLimit(earlier, used, limit.tokens))
        yield* insertThreadLine(threadId, contextLimitLineOf(limit, turn.harness), now);
    }
  }
  const status = isInterrupted ? "interrupted" : "completed";
  yield* sql`UPDATE turns SET status = ${status}, ended_at = ${now} WHERE id = ${turn.turnId}`;
  // A Companion's turn ends with its answer copied into the conversation it was asked in (thread-messaging, CHG-0781).
  yield* answerExchanges(threadId, turn.turnId, status);
  // The owner may have changed the harness or account during the turn: its session is then not the thread's.
  if (scope.kind === "main") yield* endTurn(scope, (yield* isSessionOfThread(threadId, turn)) ? sessionId : null);
  yield* finishRitualRun(threadId, isInterrupted ? "Interrupted" : "Done");
  yield* touchMission(turn.missionId, now);
  // Spending is known at the turn's end: a reached budget stops the work under it.
  const halted = usage === null ? [] : yield* enforceBudgets(turn.missionId, threadId);
  yield* resetBackupStep(threadId);
  return changed(null, {
    threadsToWake: yield* listThreadsWithPending(turn.missionId, threadId),
    // The turn's usage is the spend that budgets and the usage view add up.
    topics: [...workTopics, "spend"],
    turnsToCancel: halted.filter((id) => id !== threadId),
  });
});

/** Records failure and chooses its fallback atomically, leaving withdrawal and wakes for after commit. */
export const recordTurnFailure = Effect.fnUntraced(function* (
  threadId: string,
  turn: Admitted,
  reason: string,
  shouldFallBack = true,
) {
  const sql = yield* SqlClient.SqlClient;
  if (!(yield* isCurrentTurn(turn.turnId))) return unchanged(null);
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE turns SET status = 'failed', ended_at = ${now} WHERE id = ${turn.turnId}`;
  yield* sql`UPDATE messages SET delivered_turn_id = NULL WHERE delivered_turn_id = ${turn.turnId}`;
  // What the turn was told of Companions' answers waits for the next turn; a Companion that failed says so.
  yield* releaseContext(turn.turnId);
  const companion = yield* readCompanionOfThread(threadId);
  if (companion !== null) yield* refuseExchanges(companion, `the turn failed (${reason.trim()})`);
  yield* failTurn(threadId, reason);
  yield* touchMission(turn.missionId, now);
  const threadsToWake: string[] = [];
  if (shouldFallBack && !(yield* isRunnerChangedSince(threadId, turn))) {
    const ritual = yield* fallBackAfterFailure(threadId, reason);
    threadsToWake.push(...ritual.followUps.threadsToWake);
    const backup = yield* fallBackToBackup(threadId, reason);
    threadsToWake.push(...backup.followUps.threadsToWake);
  }
  return changed(null, {
    threadsToWake: [...new Set([...threadsToWake, ...(yield* listThreadsWithPending(turn.missionId, threadId))])],
    threadsToWithdraw: [threadId],
    topics: workTopics,
  });
});

/** A steered message was taken in by the running turn: it now belongs to that turn. */
export const deliverSteered = (turn: Admitted, messageId: string) =>
  recordStep(
    turn,
    Effect.gen(function* () {
      yield* deliverMessages([messageId], turn.turnId);
    }),
  );
