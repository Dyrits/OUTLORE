import type { BillingKind, TokenUsage } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PriceTable } from "../core/index.ts";
import type { Admitted } from "./turnAdmission.ts";

// What a turn used and what it cost, recorded when it ends (budget-control, Seeing budget use and consumption).

/**
 * Gives the turn's last reply what the turn used beyond its replies' own calls, so the lines under a turn's replies add
 * up to the turn: with no per-call usage, the whole turn's, with its cost as reported or estimated (budget-control,
 * Seeing budget use and consumption). Callers run it in a transaction, after the turn's usage is recorded.
 */
export const attachTurnRemainder = Effect.fnUntraced(function* (
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
export const modelOfTurn = Effect.fnUntraced(function* (threadId: string, turn: Admitted) {
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
export const estimateCost = Effect.fnUntraced(function* (
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
