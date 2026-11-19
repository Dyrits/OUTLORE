import { BackupCompanion, type ContextGauge, type ContextPart, type ThreadPanel } from "@outlore/contracts";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { Connectors } from "../connectors/index.ts";
import { missionLimitsOf, missionSpendingOf, notFound, spendingColumns } from "../core/index.ts";
import { harnessFacts } from "../harness/index.ts";
import { readContextLimit } from "../lore/index.ts";
import { accountOfThread } from "./budgetScopes.ts";
import { readThreadConsumption } from "./consumption.ts";
import { PlanLimits } from "./planLimits.ts";
import { readSentContextSize } from "./startingContext.ts";
import { toolListingOf } from "./threadTools.ts";
import { readAuthorityHarness } from "./turnAdmission.ts";

// What the thread panel shows beyond the thread itself (thread-panel).

const decodeBackups = Schema.decodeUnknownSync(Schema.Array(BackupCompanion));

/**
 * Splits a reported total over the counted parts. Counted parts are estimates: when they exceed the total
 * they are scaled down to fit, and the remainder, which is never negative, is the tools and their results.
 */
export const contextPartsOf = (
  total: number,
  counted: ReadonlyArray<Pick<ContextPart, "kind" | "tokens">>,
): ReadonlyArray<ContextPart> => {
  const countedSum = counted.reduce((sum, part) => sum + part.tokens, 0);
  const scale = countedSum > total ? total / countedSum : 1;
  const parts = counted.map((part) => ({ kind: part.kind, tokens: Math.floor(part.tokens * scale) }));
  const known = parts.reduce((sum, part) => sum + part.tokens, 0);
  return [...parts, { kind: "ToolsAndResults", tokens: total - known }];
};

/** The context gauge of a thread, or null while no turn has reported its context. */
const readContextGauge = Effect.fnUntraced(function* (threadId: string, model: string) {
  const sql = yield* SqlClient.SqlClient;
  // The latest turn that reported one, not a sum over turns: the context is what the window holds now.
  const [latest] = yield* sql<{ context: number }>`
      SELECT context FROM usage WHERE thread_id = ${threadId} AND context IS NOT NULL
      ORDER BY ended_at DESC, rowid DESC LIMIT 1`;
  if (latest === undefined) return null;
  const limit = yield* readContextLimit(model, threadId);
  const sent = yield* readSentContextSize(threadId);
  const [{ messageText } = { messageText: 0 }] = yield* sql<{ messageText: number }>`
      SELECT COALESCE(SUM(LENGTH(text)), 0) AS messageText FROM messages WHERE thread_id = ${threadId}`;
  return {
    isSoftLimit: limit.isSoftLimit,
    parts: contextPartsOf(latest.context, [
      { kind: "Instructions", tokens: sent.instructions },
      { kind: "Lore", tokens: sent.lore },
      { kind: "Journal", tokens: sent.journal },
      { kind: "Messages", tokens: sent.openerMessages + Math.ceil(messageText / 4) },
    ]),
    tokens: latest.context,
    windowTokens: limit.tokens,
  } satisfies ContextGauge;
});

/** The plan limits of the account the thread runs on, as last reported. */
const readThreadPlanLimits = Effect.fnUntraced(function* (threadId: string) {
  const account = yield* accountOfThread(threadId);
  return account === null ? null : yield* (yield* PlanLimits).latest(account);
});

/** What the panel shows of a thread: its context gauge, its own spending, and its quest's budget. */
export const readThreadPanel = Effect.fnUntraced(function* (threadId: string, connectors: Connectors["Service"]) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ backups: string; missionId: string; model: string }>`
      SELECT mission_id AS missionId, model, backups FROM threads WHERE id = ${threadId}`;
  if (thread === undefined) return yield* notFound("No such thread.");
  const harness = yield* readAuthorityHarness(threadId);
  const [spent] = yield* sql<{ cost: number; tokens: number; turnCount: number }>`
      SELECT ${sql.literal(spendingColumns)}, COUNT(*) AS turnCount FROM usage u WHERE u.thread_id = ${threadId}`;
  return {
    backups: decodeBackups(JSON.parse(thread.backups)),
    budget: { limits: yield* missionLimitsOf(thread.missionId), spent: yield* missionSpendingOf(thread.missionId) },
    connectorTools: yield* connectors.panelTools(threadId),
    consumption: yield* readThreadConsumption(threadId),
    context: yield* readContextGauge(threadId, thread.model),
    outloreTools: toolListingOf(harness !== null && harnessFacts[harness].hasPromptTool).map((tool) => tool.name),
    planLimits: yield* readThreadPlanLimits(threadId),
    spending: { cost: spent?.cost ?? 0, tokens: spent?.tokens ?? 0 },
    turnCount: spent?.turnCount ?? 0,
  } satisfies ThreadPanel;
});
