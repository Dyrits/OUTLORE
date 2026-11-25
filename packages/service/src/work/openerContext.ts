import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { missionOf } from "./journal.ts";

// What a new thread is told of its opener's conversation (thread-tree, Opening a thread).

/** How many of its opener's latest messages a thread opened by the owner reads on its first turn (thread-tree, Opening a thread). */
const openerTailCount = 5;
/** How much of each of those messages it reads; `read_parent_messages` gives the rest. */
const openerTailLength = 500;

/** How a message's sender reads in a conversation excerpt: the owner, the opener, or a thread by its title. */
export const senderLabelOf = (row: { sender: string; fromTitle: string | null; isResult: boolean }) =>
  row.sender === "user"
    ? "Owner"
    : row.sender === "agent"
      ? "Opener"
      : `${row.isResult ? "Result from" : "Message from"} thread "${row.fromTitle ?? ""}"`;

/**
 * What a new thread is told of its opener's conversation (thread-tree, Opening a thread): how many messages the opener
 * has, and that `read_parent_messages` reads, pages, and searches them. The messages themselves stay out, so each turn
 * carries a line, not a snapshot; null when the opener has none. Captured when the thread is opened.
 */
export const openerMessagesOf = Effect.fnUntraced(function* (openerId: string) {
  const sql = yield* SqlClient.SqlClient;
  const missionId = yield* missionOf(openerId);
  const [latest] = yield* sql<{ writtenAt: number | null }>`
      SELECT MAX(written_at) AS writtenAt FROM journal_entries WHERE mission_id = ${missionId}`;
  // At or after the entry's millisecond: a message written in the same millisecond counts as after it.
  const since = latest?.writtenAt ?? 0;
  const [counted] = yield* sql<{ total: number; recent: number }>`
      SELECT COUNT(*) AS total, COALESCE(SUM(sent_at >= ${since}), 0) AS recent FROM messages
      WHERE thread_id = ${openerId} AND sender_kind != 'system'`;
  const total = counted?.total ?? 0;
  if (total === 0) return null;
  const messages = (count: number) => `${count} ${count === 1 ? "message" : "messages"}`;
  return [
    `When you were opened, your opener had ${messages(total)}, ${counted?.recent ?? 0} of them since the latest journal entry. None are included here.`,
    "Call read_parent_messages to read them, newest first: pass before to page back, or query to search them by words.",
  ].join(" ");
});

/**
 * The opener's latest messages, as a thread the owner opens beneath it reads them on its first turn: the last few,
 * each clipped, with the labels of the opener's messages; null when there are none. A short request such as "fix this"
 * leans on them, and a thread cannot tell what it is missing, so they are not left to `read_parent_messages` alone.
 */
export const openerTailOf = Effect.fnUntraced(function* (openerId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ sender: string; fromTitle: string | null; isResult: number; text: string }>`
      SELECT sender_kind AS sender, sender_title AS fromTitle, is_result AS isResult, text FROM messages
      WHERE thread_id = ${openerId} AND sender_kind != 'system'
      ORDER BY sequence DESC LIMIT ${openerTailCount}`;
  if (rows.length === 0) return null;
  return rows
    .toReversed()
    .map((row) => {
      const text = row.text.length <= openerTailLength ? row.text : `${row.text.slice(0, openerTailLength - 1)}…`;
      return `${senderLabelOf({ ...row, isResult: row.isResult === 1 })}:\n${text}`;
    })
    .join("\n\n");
});

/**
 * The opener's conversation as each turn's message carries it, after the journal: the line on how much there is, and, on
 * the first turn of a thread the owner opened, its opener's latest messages. Null when there is none.
 */
export const openerContextOf = (openerMessages: string | null, openerTail: string | null = null) =>
  openerMessages === null
    ? null
    : [
        "# Your opener's conversation",
        openerMessages,
        ...(openerTail === null
          ? []
          : ["", "Its latest messages when you were opened, clipped, on this turn only:", "", openerTail]),
      ].join("\n");
