import { messageMarks } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { newId, touchMission } from "../core/index.ts";
import { type CompanionThread, readCompanionOfThread } from "./companionThreads.ts";
import { appendMessage } from "./messageStorage.ts";

// One question to a Companion and its answer (thread-messaging, Mentioning a Companion with @; CHG-0781): the owner's
// message stays in the conversation and wakes nobody; the Companion's thread answers it; the answer is copied under the
// owner's message labelled with the model, and the conversation's own Companion is told of both as context only.

/** The first line of a refusal in a Companion's own words, before the cause. */
export const refusalLead = "Cannot answer:";

/** Records that a message asked a Companion, with the message delivered to the Companion's thread. Callers run it in a transaction. */
export const openExchange = Effect.fnUntraced(function* (exchange: {
  readonly companionThreadId: string;
  readonly ownerMessageId: string;
  readonly parentThreadId: string;
  readonly promptMessageId: string | null;
}) {
  const sql = yield* SqlClient.SqlClient;
  const id = yield* newId;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`INSERT INTO companion_exchanges (id, parent_thread_id, companion_thread_id, owner_message_id, prompt_message_id, state, asked_at)
      VALUES (${id}, ${exchange.parentThreadId}, ${exchange.companionThreadId}, ${exchange.ownerMessageId},
        ${exchange.promptMessageId}, 'Asked', ${now})`;
  return id;
});

type Exchange = { readonly id: string; readonly ownerMessageId: string; readonly promptMessageId: string | null };

/**
 * Writes `text` into the conversation as the Companion's message under the owner's, and answers the exchanges with it.
 * The message names the Companion's harness and model and carries its account's label.
 */
const answerWith = Effect.fnUntraced(function* (
  companion: CompanionThread,
  exchanges: ReadonlyArray<Exchange>,
  text: string,
) {
  const sql = yield* SqlClient.SqlClient;
  const last = exchanges.at(-1);
  if (last === undefined) return;
  const [parent] = yield* sql<{
    missionId: string;
  }>`SELECT mission_id AS missionId FROM threads WHERE id = ${companion.parentThreadId}`;
  if (parent === undefined) return;
  const now = yield* Clock.currentTimeMillis;
  const replyId = yield* appendMessage({
    fromThreadId: null,
    harness: companion.harness,
    isQueued: false,
    isResult: false,
    missionId: parent.missionId,
    model: companion.model,
    now,
    senderKind: "agent",
    senderTitle: companion.accountLabel,
    text,
    threadId: companion.parentThreadId,
  });
  yield* sql`UPDATE messages SET reply_to_message_id = ${last.ownerMessageId} WHERE id = ${replyId}`;
  for (const exchange of exchanges)
    yield* sql`UPDATE companion_exchanges SET state = 'Answered', reply_message_id = ${replyId} WHERE id = ${exchange.id}`;
  yield* touchMission(parent.missionId, now);
});

/** The exchanges the Companion's thread has not answered yet, oldest first, with the message that delivered each. */
const readAsked = Effect.fnUntraced(function* (companionThreadId: string, turnId: string | null) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<Exchange>`
    SELECT e.id, e.owner_message_id AS ownerMessageId, e.prompt_message_id AS promptMessageId
    FROM companion_exchanges e LEFT JOIN messages p ON p.id = e.prompt_message_id
    WHERE e.companion_thread_id = ${companionThreadId} AND e.state = 'Asked'
      AND (${turnId === null} OR p.delivered_turn_id = ${turnId})
    ORDER BY e.asked_at, e.rowid`;
});

/** A cause as a line of its own: first line only, not longer than a screen line holds. */
const causeOf = (reason: string) => {
  const line = reason.trim().split("\n", 1)[0] ?? "";
  return line.length > 240 ? `${line.slice(0, 237)}...` : line;
};

/**
 * Says in the conversation that the Companion cannot answer, with the cause, for every question it holds. The questions
 * its thread was given are dropped, so a later mention does not deliver them again. Callers run it in a transaction.
 */
export const refuseExchanges = Effect.fnUntraced(function* (companion: CompanionThread, cause: string) {
  const sql = yield* SqlClient.SqlClient;
  const asked = yield* readAsked(companion.threadId, null);
  const ids = asked.flatMap((exchange) => (exchange.promptMessageId === null ? [] : [exchange.promptMessageId]));
  if (ids.length > 0) yield* sql`UPDATE messages SET is_conversation_only = 1 WHERE id IN ${sql.in(ids)}`;
  yield* answerWith(companion, asked, `${refusalLead} ${causeOf(cause)}`);
});

/**
 * A Companion's turn ended with this reply: the last message it wrote since it was asked, copied into the conversation
 * for the questions the turn took in. A turn that wrote nothing, or was interrupted, says so instead.
 */
export const answerExchanges = Effect.fnUntraced(function* (
  companionThreadId: string,
  turnId: string,
  outcome: "completed" | "interrupted",
) {
  const sql = yield* SqlClient.SqlClient;
  const companion = yield* readCompanionOfThread(companionThreadId);
  if (companion === null) return;
  const taken = yield* readAsked(companionThreadId, turnId);
  const first = taken[0];
  if (first === undefined) return;
  const [reply] = yield* sql<{ text: string }>`
    SELECT text FROM messages
    WHERE thread_id = ${companionThreadId} AND sender_kind = 'agent' AND TRIM(text) != ''
      AND sequence > COALESCE((SELECT sequence FROM messages WHERE id = ${first.promptMessageId}), 0)
    ORDER BY sequence DESC LIMIT 1`;
  const text =
    outcome === "interrupted"
      ? `${refusalLead} its turn was interrupted.`
      : (reply?.text.trim() ?? `${refusalLead} it ended its turn with no reply.`);
  yield* answerWith(companion, taken, text);
});

/** What the conversation's own Companion is told on its next turn, and which exchanges it covers; empty when none is unsaid. */
export const readCompanionContext = Effect.fnUntraced(function* (parentThreadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ asked: string; answer: string; id: string; model: string; account: string | null }>`
    SELECT e.id, o.text AS asked, r.text AS answer, t.model, a.label AS account
    FROM companion_exchanges e JOIN messages o ON o.id = e.owner_message_id JOIN messages r ON r.id = e.reply_message_id
      JOIN threads t ON t.id = e.companion_thread_id LEFT JOIN accounts a ON a.id = t.account_id
    WHERE e.parent_thread_id = ${parentThreadId} AND e.state = 'Answered' AND e.context_turn_id IS NULL
    ORDER BY e.asked_at, e.rowid`;
  if (rows.length === 0) return { ids: [], text: "" };
  const clip = (text: string, limit: number) => {
    const flat = text.replace(/\s+/g, " ").trim();
    return flat.length > limit ? `${flat.slice(0, limit - 3)}...` : flat;
  };
  const lines = rows.map(
    (row) =>
      `- ${row.model}${row.account === null ? "" : ` · ${row.account}`}: asked "${clip(row.asked, 300)}", answered "${clip(row.answer, 600)}"`,
  );
  return { ids: rows.map((row) => row.id), text: [messageMarks.companion.deliveryHeading, ...lines].join("\n") };
});

/** Marks the exchanges as told to the turn, so no later turn tells them again. Callers run it in a transaction. */
export const markContextDelivered = Effect.fnUntraced(function* (ids: ReadonlyArray<string>, turnId: string) {
  const sql = yield* SqlClient.SqlClient;
  if (ids.length > 0) yield* sql`UPDATE companion_exchanges SET context_turn_id = ${turnId} WHERE id IN ${sql.in(ids)}`;
});

/** A failed turn's exchanges were not told: they are told by the next turn that runs. Callers run it in a transaction. */
export const releaseContext = Effect.fnUntraced(function* (turnId: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE companion_exchanges SET context_turn_id = NULL WHERE context_turn_id = ${turnId}`;
});

/**
 * After a restart no turn is running, so a question a Companion was asked and had not answered never will be: each says so
 * in its conversation, and the owner asks again. Callers run it in a transaction.
 */
export const refuseUnansweredExchanges = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ threadId: string }>`
    SELECT DISTINCT e.companion_thread_id AS threadId FROM companion_exchanges e
    WHERE e.state = 'Asked'
      AND NOT EXISTS (SELECT 1 FROM turns t WHERE t.thread_id = e.companion_thread_id AND t.status = 'running')`;
  for (const row of rows) {
    const companion = yield* readCompanionOfThread(row.threadId);
    if (companion !== null) yield* refuseExchanges(companion, "Outlore restarted before it answered");
  }
});
