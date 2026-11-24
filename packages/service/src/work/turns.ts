import type { BillingKind, TokenUsage } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import type { FileChange } from "../core/fileChanges.ts";
import { PriceTable, type TurnOutcome, touchMission } from "../core/index.ts";
import { readContextLimit } from "../lore/index.ts";
import { callDescriptionOf, saveActivityChange } from "./activities.ts";
import { fallBackToBackup, resetBackupStep } from "./backups.ts";
import { enforceBudgets } from "./budgets.ts";
import { readLatestContextUsed, recordContextReading } from "./contextReadings.ts";
import { contextLimitLineOf, hasReachedLimit } from "./contextWarning.ts";
import { changed, unchanged } from "./followUps.ts";
import { insertThreadLine, isRunnerChangedSince, isSessionOfThread } from "./handover.ts";
import { endTurn, failTurn } from "./lifecycle.ts";
import { deliverMessages, insertReply, listThreadsWithPending } from "./messaging.ts";
import { fallBackAfterFailure, finishRitualRun } from "./rituals.ts";
import { type Admitted, isCurrentTurn } from "./turnAdmission.ts";
import { moveWorkingFolder } from "./workingFolders.ts";

// Turn operations return follow-ups; the command runner commits and applies them.

/** Records a current turn's incremental event in the command's transaction. */
const recordStep = Effect.fnUntraced(function* <A, E, R>(turn: Admitted, step: Effect.Effect<A, E, R>) {
  if (!(yield* isCurrentTurn(turn.turnId))) return unchanged(null);
  yield* step;
  return changed(null);
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
      const written = model ?? (turn.model === "default" ? null : turn.model);
      const messageId = yield* insertReply(turn.missionId, threadId, text, { harness: turn.harness, model: written });
      // The call behind the reply, when the harness reports usage per call; the turn's remainder joins it at the turn's end.
      if (usage !== null) {
        const sql = yield* SqlClient.SqlClient;
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
 * Gives the turn's last reply what the turn used beyond its replies' own calls, so the lines under a turn's replies add
 * up to the turn: with no per-call usage, the whole turn's, with its cost as reported or estimated (budget-control,
 * Seeing budget use and consumption). Callers run it in a transaction, after the turn's usage is recorded.
 */
const attachTurnRemainder = Effect.fnUntraced(function* (
  threadId: string,
  turn: Admitted,
  usage: TokenUsage,
  turnCost: { readonly estimate: number | null; readonly reported: number | null },
) {
  const sql = yield* SqlClient.SqlClient;
  const replies = yield* sql<{ id: string; model: string | null }>`
      SELECT m.id, m.model FROM messages m
      WHERE m.thread_id = ${threadId} AND m.sender_kind = 'agent'
        AND m.sent_at >= (SELECT started_at FROM turns WHERE id = ${turn.turnId})
      ORDER BY m.sequence`;
  const last = replies.at(-1);
  if (last === undefined) return;
  const [own] = yield* sql<TokenUsage>`
      SELECT COALESCE(SUM(input), 0) AS input, COALESCE(SUM(output), 0) AS output,
        COALESCE(SUM(cache_read), 0) AS cacheRead, COALESCE(SUM(cache_creation), 0) AS cacheCreation
      FROM reply_usage WHERE message_id IN ${sql.in(replies.map((reply) => reply.id))}`;
  const spent = own ?? { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
  const rest = {
    cacheCreation: Math.max(0, usage.cacheCreation - spent.cacheCreation),
    cacheRead: Math.max(0, usage.cacheRead - spent.cacheRead),
    input: Math.max(0, usage.input - spent.input),
    output: Math.max(0, usage.output - spent.output),
  };
  if (rest.input + rest.output + rest.cacheRead + rest.cacheCreation === 0) return;
  const [existing] = yield* sql<{
    estimate: number | null;
  }>`SELECT estimate FROM reply_usage WHERE message_id = ${last.id}`;
  const isWholeTurn = spent.input + spent.output + spent.cacheRead + spent.cacheCreation === 0;
  // A whole turn carries the turn's own cost; a remainder adds to the call's own estimate.
  const restEstimate = isWholeTurn
    ? turnCost.estimate
    : last.model === null
      ? null
      : ((yield* (yield* PriceTable).estimate(last.model, rest))?.amount ?? null);
  const estimate =
    existing === undefined || existing.estimate === null
      ? restEstimate
      : restEstimate === null
        ? existing.estimate
        : Math.round((existing.estimate + restEstimate) * 1e6) / 1e6;
  yield* sql`INSERT INTO reply_usage (message_id, input, output, cache_read, cache_creation, estimate, reported)
      VALUES (${last.id}, ${rest.input}, ${rest.output}, ${rest.cacheRead}, ${rest.cacheCreation}, ${estimate}, ${isWholeTurn ? turnCost.reported : null})
      ON CONFLICT (message_id) DO UPDATE SET input = input + excluded.input, output = output + excluded.output,
        cache_read = cache_read + excluded.cache_read, cache_creation = cache_creation + excluded.cache_creation,
        estimate = excluded.estimate, reported = excluded.reported`;
});

/**
 * The model a turn ran on, as its estimate is priced: the model the thread chose, or for the harness's own default
 * the model that wrote the thread's latest reply; null when neither is known.
 */
const modelOfTurn = Effect.fnUntraced(function* (threadId: string, turn: Admitted) {
  if (turn.model !== "default") return turn.model;
  const sql = yield* SqlClient.SqlClient;
  const [reply] = yield* sql<{ model: string }>`
      SELECT model FROM messages WHERE thread_id = ${threadId} AND sender_kind = 'agent' AND model IS NOT NULL
      ORDER BY sequence DESC LIMIT 1`;
  return reply?.model ?? null;
});

/**
 * A turn's estimated cost, stamped with where it came from: the price table, or the harness's own figure for a
 * model the table lacks (budget-control, Estimated cost). Null leaves the turn unpriced.
 */
const estimateCost = Effect.fnUntraced(function* (
  prices: PriceTable["Service"],
  model: string | null,
  usage: TokenUsage,
  billing: BillingKind,
  cost: number | null,
  at: number,
) {
  const fromTable = model === null ? null : yield* prices.estimate(model, usage);
  if (fromTable !== null) return { amount: fromTable.amount, pricedAt: fromTable.pricedAt, source: "Table" } as const;
  if (billing !== "ApiKey" && cost !== null) return { amount: cost, pricedAt: at, source: "Harness" } as const;
  return null;
});

/**
 * Ends a completed or interrupted turn (CHG-0039), with cancellation and wake follow-ups after its usage commits.
 */
export const completeTurn = Effect.fnUntraced(function* (threadId: string, turn: Admitted, outcome: TurnOutcome) {
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
  // The owner may have changed the harness or account during the turn: its session is then not the thread's.
  yield* endTurn(threadId, turn.turnId, (yield* isSessionOfThread(threadId, turn)) ? sessionId : null);
  yield* finishRitualRun(threadId, isInterrupted ? "Interrupted" : "Done");
  yield* touchMission(turn.missionId, now);
  // Spending is known at the turn's end: a reached budget stops the work under it.
  const halted = usage === null ? [] : yield* enforceBudgets(turn.missionId, threadId);
  yield* resetBackupStep(threadId);
  return changed(null, {
    threadsToWake: yield* listThreadsWithPending(turn.missionId, threadId),
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
