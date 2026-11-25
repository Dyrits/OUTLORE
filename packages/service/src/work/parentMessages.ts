import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { toolRefusal, toolText } from "../core/index.ts";
import { clip } from "./guildmasterText.ts";
import { senderLabelOf } from "./journal.ts";
import type { ArgumentsOf } from "./threadTools.ts";

/** The most words a search uses; more would only widen it. */
const wordLimit = 12;
/** How much of a message a plain read, or a search without full-text support, shows. */
const readLength = 800;

type MessageRow = {
  readonly fromTitle: string | null;
  readonly isResult: number;
  readonly sender: string;
  readonly sequence: number;
  readonly text: string;
};

const lineOf = (row: MessageRow, text: string) =>
  `#${row.sequence} ${senderLabelOf({ ...row, isResult: row.isResult === 1 })}: ${text}`;

/** The words of a query, lowercase, which search and the fallback both use. */
export const wordsOf = (query: string) =>
  [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, wordLimit * 2))].slice(0, wordLimit);

/** An FTS5 query for the words: each one a quoted prefix term, any of which may match; the best match ranks first. */
export const matchOf = (words: ReadonlyArray<string>) => words.map((word) => `"${word}"*`).join(" OR ");

/** An excerpt of the text around its first matching word, so a hit shows why it matched. */
const excerptOf = (text: string, words: ReadonlyArray<string>) => {
  const lower = text.toLowerCase();
  const at = Math.min(...words.map((word) => lower.indexOf(word)).filter((index) => index >= 0), text.length);
  const start = Math.max(at - 100, 0);
  return `${start > 0 ? "…" : ""}${clip(text.slice(start), 300)}`;
};

/**
 * What `read_parent_messages` answers: the messages of the thread that opened the caller, newest first, or the best
 * matches for some words. The opener's conversation is not part of a thread's context (thread-tree, Opening a thread):
 * the thread reads as much of it as it needs, and no more.
 */
export const readParentMessages = Effect.fnUntraced(function* (
  callerId: string,
  args: ArgumentsOf<"read_parent_messages">,
) {
  const sql = yield* SqlClient.SqlClient;
  const [caller] = yield* sql<{ isAside: number; parentId: string | null }>`
      SELECT parent_id AS parentId, is_aside AS isAside FROM threads WHERE id = ${callerId}`;
  if (caller === undefined || caller.parentId === null)
    return toolRefusal("You have no opener: you are a quest's top thread, so there is no parent conversation to read.");
  if (caller.isAside === 1)
    return toolRefusal("An aside starts from its request alone: its opener's conversation is not for it to read.");
  const parentId = caller.parentId;
  const count = Math.min(Math.max(args.count ?? 10, 1), 40);
  const before = args.before ?? null;
  const words = wordsOf(args.query ?? "");
  const none = toolText("No such messages.");
  if (words.length === 0) {
    const rows = yield* sql<MessageRow>`
        SELECT sequence, sender_kind AS sender, sender_title AS fromTitle, is_result AS isResult, text FROM messages
        WHERE thread_id = ${parentId} AND sender_kind != 'system' AND (${before} IS NULL OR sequence < ${before})
        ORDER BY sequence DESC LIMIT ${count}`;
    return rows.length === 0 ? none : toolText(rows.map((row) => lineOf(row, clip(row.text, readLength))).join("\n\n"));
  }
  const [index] = yield* sql<{ found: number }>`SELECT 1 AS found FROM sqlite_master WHERE name = 'messages_fts'`;
  const hint =
    "\n\nBest matches first. To read one in full, call again with before set to its number plus 1, count 1, and no query.";
  if (index !== undefined) {
    const rows = yield* sql<MessageRow>`
        SELECT m.sequence, m.sender_kind AS sender, m.sender_title AS fromTitle, m.is_result AS isResult,
          snippet(messages_fts, 0, '', '', '…', 40) AS text
        FROM messages_fts JOIN messages m ON m.rowid = messages_fts.rowid
        WHERE messages_fts MATCH ${matchOf(words)} AND m.thread_id = ${parentId} AND m.sender_kind != 'system'
          AND (${before} IS NULL OR m.sequence < ${before})
        ORDER BY bm25(messages_fts) LIMIT ${count}`;
    return rows.length === 0 ? none : toolText(rows.map((row) => lineOf(row, row.text)).join("\n\n") + hint);
  }
  // Without full-text search: the newest thousand messages, ranked by how many of the words each holds.
  const rows = yield* sql<MessageRow>`
      SELECT sequence, sender_kind AS sender, sender_title AS fromTitle, is_result AS isResult, text FROM messages
      WHERE thread_id = ${parentId} AND sender_kind != 'system' AND (${before} IS NULL OR sequence < ${before})
      ORDER BY sequence DESC LIMIT 1000`;
  const ranked = rows
    .map((row) => ({ row, score: words.filter((word) => row.text.toLowerCase().includes(word)).length }))
    .filter((match) => match.score > 0)
    .toSorted((first, second) => second.score - first.score || second.row.sequence - first.row.sequence)
    .slice(0, count);
  return ranked.length === 0
    ? none
    : toolText(ranked.map((match) => lineOf(match.row, excerptOf(match.row.text, words))).join("\n\n") + hint);
});
