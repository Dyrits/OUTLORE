import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";
import { removeAttachmentFiles } from "./attachments.ts";

/** The inbox still owns the message. A release for steering and a turn admission both end this window. */
const isEditable = (sql: SqlClient.SqlClient, messageId: string) =>
  sql`id = ${messageId} AND sender_kind = 'user' AND is_queued = 1
      AND delivered_turn_id IS NULL AND is_conversation_only = 0`;

/** Changes the text in place, with attachments and its position in the queue intact. */
export const editQueuedMessage = Effect.fnUntraced(function* (messageId: string, text: string) {
  const sql = yield* SqlClient.SqlClient;
  const [message] = yield* sql<{ id: string }>`SELECT id FROM messages WHERE ${isEditable(sql, messageId)}`;
  if (message === undefined) return yield* invalid("This message is no longer queued.");
  if (text.trim() === "") {
    const [attachment] = yield* sql`SELECT id FROM attachments WHERE message_id = ${messageId} LIMIT 1`;
    if (attachment === undefined) return yield* invalid("The message is empty.");
  }
  yield* sql`UPDATE messages SET text = ${text} WHERE id = ${messageId}`;
});

/** Removes a message and its files in the command's transaction. Disk cleanup follows commit. */
export const removeQueuedMessage = Effect.fnUntraced(function* (messageId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [message] = yield* sql<{ id: string }>`SELECT id FROM messages WHERE ${isEditable(sql, messageId)}`;
  if (message === undefined) return yield* invalid("This message is no longer queued.");
  const files = yield* sql<{ file: string }>`DELETE FROM attachments WHERE message_id = ${messageId} RETURNING file`;
  yield* sql`DELETE FROM messages WHERE id = ${messageId}`;
  if (files.length > 0) {
    yield* sql.afterCommit(
      // After the commit the removal is already decided and no caller is left to receive a failure: a log is its only record.
      removeAttachmentFiles(files.map(({ file }) => file)).pipe(
        Effect.catchCause((cause) => Effect.logWarning("Queued message attachment cleanup failed", cause)),
      ),
    );
  }
});
