import type { HarnessName } from "@outlore/contracts";
import {
  type CompanionReference,
  companionTokensOf,
  maxCompanionMentions,
  type SendToParentScope,
  withoutCompanionTokens,
} from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound } from "../core/index.ts";
import { openExchange, refuseExchanges } from "./companionExchanges.ts";
import { readCompanionRefusal } from "./companionRefusals.ts";
import { ensureCompanionThread } from "./companionThreads.ts";
import { insertMessage, insertUserMessage } from "./messaging.ts";
import { isChroniclerThread } from "./questVisibility.ts";

// Asking the Companions a message names (thread-messaging, Mentioning a Companion with @; CHG-0781). The owner's message
// is already in the conversation, delivered to nobody; each Companion gets its own thread, the owner's words, and what
// the conversation said since it last looked, and answers once.

/** The most of the conversation a Companion is shown with a question, newest last. */
const contextCharacters = 12_000;

/** The conversation between what the Companion last saw and the owner's message, as lines for it; empty when there is none. */
const readConversationSince = Effect.fnUntraced(function* (
  parentThreadId: string,
  companionThreadId: string,
  ownerMessageId: string,
) {
  const sql = yield* SqlClient.SqlClient;
  const [seen] = yield* sql<{ sequence: number }>`
    SELECT COALESCE((SELECT m.sequence FROM companion_threads c JOIN messages m ON m.id = c.last_seen_message_id
      WHERE c.thread_id = ${companionThreadId}), 0) AS sequence`;
  const rows = yield* sql<{
    harness: HarnessName | null;
    model: string | null;
    sender: string;
    text: string;
    title: string | null;
  }>`
    SELECT m.sender_kind AS sender, m.text, m.model, m.harness, COALESCE(s.title, m.sender_title) AS title
    FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id
    WHERE m.thread_id = ${parentThreadId} AND m.sender_kind IN ('user', 'agent', 'thread') AND TRIM(m.text) != ''
      AND m.sequence > ${seen?.sequence ?? 0}
      AND m.sequence < (SELECT sequence FROM messages WHERE id = ${ownerMessageId})
      AND m.id NOT IN (SELECT e.owner_message_id FROM companion_exchanges e WHERE e.companion_thread_id = ${companionThreadId})
      AND m.id NOT IN (SELECT e.reply_message_id FROM companion_exchanges e
        WHERE e.companion_thread_id = ${companionThreadId} AND e.reply_message_id IS NOT NULL)
    ORDER BY m.sequence`;
  const lines = rows.map((row) => {
    const speaker =
      row.sender === "user"
        ? "The owner"
        : row.sender === "thread"
          ? `Thread "${row.title ?? "a thread"}"`
          : row.title === null
            ? "The conversation's Companion"
            : `${row.model ?? "a Companion"} · ${row.title}`;
    return `${speaker}: ${row.text.trim()}`;
  });
  const kept: Array<string> = [];
  let used = 0;
  for (const line of lines.toReversed()) {
    if (used + line.length > contextCharacters && kept.length > 0) break;
    kept.unshift(line.length > contextCharacters ? line.slice(-contextCharacters) : line);
    used += line.length;
  }
  return { kept, omitted: lines.length - kept.length };
});

/** What the Companion's thread is given: the owner's words and the conversation since it last looked. */
const promptOf = (words: string, context: { readonly kept: ReadonlyArray<string>; readonly omitted: number }) =>
  [
    words === ""
      ? "The owner named you with @ and wrote nothing else: answer what the conversation below asks of you."
      : words,
    ...(context.kept.length === 0
      ? []
      : [
          [
            "## The conversation so far",
            "The owner wrote the message above in this conversation, beside another Companion that carries it. What was said since you last looked, oldest first:",
            ...(context.omitted > 0
              ? [`(${context.omitted} earlier messages were left out because the conversation is long.)`]
              : []),
            context.kept.join("\n\n"),
          ].join("\n\n"),
        ]),
  ].join("\n\n");

/** The distinct Companions already participating in a frame, in the order they were first asked. */
const readFrameCompanions = Effect.fnUntraced(function* (parentThreadId: string, frameMessageId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ accountId: string | null; harness: string; model: string }>`
    SELECT t.harness, t.account_id AS accountId, t.model
    FROM companion_exchanges e JOIN threads t ON t.id = e.companion_thread_id
    WHERE e.parent_thread_id = ${parentThreadId} AND COALESCE(e.frame_message_id, e.owner_message_id) = ${frameMessageId}
    GROUP BY t.harness, t.account_id, t.model
    ORDER BY MIN(e.asked_at), MIN(e.rowid)`;
  return rows.map((row): CompanionReference => ({ accountId: row.accountId, harness: row.harness, model: row.model }));
});

/** Combines a frame's Companions with any newly `@`-mentioned ones, deduplicated and capped at `maxCompanionMentions`. */
const mergeCompanionTokens = (
  existing: ReadonlyArray<CompanionReference>,
  mentioned: ReadonlyArray<CompanionReference>,
): ReadonlyArray<CompanionReference> => {
  const seen = new Set<string>();
  const combined: Array<CompanionReference> = [];
  for (const token of [...existing, ...mentioned]) {
    const key = `${token.harness}:${token.accountId ?? "-"}:${token.model}`;
    if (seen.has(key)) continue;
    seen.add(key);
    combined.push(token);
    if (combined.length >= maxCompanionMentions) break;
  }
  return combined;
};

/**
 * Asks each Companion the message names: one thread per model and conversation, found or made; a Companion that cannot
 * answer now answers so at once, in the conversation, and the others are given the question. Returns the Companions'
 * threads to wake. Callers run it in a transaction, once the owner's message is stored.
 */
export const askCompanions = Effect.fnUntraced(function* (
  parentThreadId: string,
  ownerMessageId: string,
  text: string,
  tokens: ReadonlyArray<CompanionReference>,
  frameMessageId: string,
) {
  const sql = yield* SqlClient.SqlClient;
  const words = withoutCompanionTokens(text);
  const threadsToWake: Array<string> = [];
  for (const token of tokens) {
    const companion = yield* ensureCompanionThread(parentThreadId, {
      accountId: token.accountId,
      harness: token.harness as HarnessName,
      model: token.model,
    });
    const refusal = yield* readCompanionRefusal(companion);
    const context = yield* readConversationSince(parentThreadId, companion.threadId, ownerMessageId);
    // The owner's message stays with the conversation; the Companion's thread gets its own copy of the words.
    const { messageId: promptId } = yield* insertMessage({
      fromThreadId: null,
      isConversationOnly: refusal !== null,
      isQueued: false,
      isResult: false,
      text: promptOf(words, context),
      threadId: companion.threadId,
    });
    yield* openExchange({
      companionThreadId: companion.threadId,
      frameMessageId,
      ownerMessageId,
      parentThreadId,
      promptMessageId: promptId,
    });
    yield* sql`UPDATE companion_threads SET last_seen_message_id = ${ownerMessageId} WHERE thread_id = ${companion.threadId}`;
    if (refusal === null) threadsToWake.push(companion.threadId);
    else yield* refuseExchanges(companion, refusal);
  }
  return threadsToWake;
});

/**
 * Records the owner's message in a conversation. A message that names Companions with `@`, or follows up inside an
 * existing Companion frame (`frameMessageId`), is theirs to answer: it joins the conversation as written, delivered to
 * no one, and each Companion named is asked; any other message is delivered as always. Chronicler's conversation opens
 * nothing, so `@` words there stay plain text.
 */
export const insertOwnerMessage = Effect.fnUntraced(function* (message: {
  readonly attachmentIds: ReadonlyArray<string>;
  readonly frameMessageId?: string | null;
  readonly isQueued: boolean;
  readonly realmPath: string | null;
  readonly sentToParent: SendToParentScope | null;
  readonly text: string;
  readonly threadId: string;
  readonly viewing: string | null;
}) {
  const { attachmentIds, frameMessageId = null, isQueued, realmPath, sentToParent, text, threadId, viewing } = message;
  const sql = yield* SqlClient.SqlClient;
  const isChronicler = yield* isChroniclerThread(threadId);
  const mentioned = isChronicler ? [] : companionTokensOf(text);
  let tokens: ReadonlyArray<CompanionReference>;
  if (frameMessageId !== null) {
    if (isChronicler) return yield* notFound("No such side conversation.");
    const existing = yield* readFrameCompanions(threadId, frameMessageId);
    if (existing.length === 0) return yield* notFound("No such side conversation.");
    tokens = mergeCompanionTokens(existing, mentioned);
  } else {
    if (mentioned.length === 0)
      return yield* insertUserMessage(threadId, text, isQueued, attachmentIds, realmPath, viewing, sentToParent);
    tokens = mentioned;
  }
  const { messageId } = yield* insertMessage({
    attachmentIds,
    fromThreadId: null,
    isConversationOnly: true,
    isQueued: false,
    isResult: false,
    text,
    threadId,
    viewing,
  });
  if (frameMessageId !== null)
    yield* sql`UPDATE messages SET reply_to_message_id = ${frameMessageId} WHERE id = ${messageId}`;
  const threadsToWake = yield* askCompanions(threadId, messageId, text, tokens, frameMessageId ?? messageId);
  return { threadsToWake, value: { messageId } };
});
