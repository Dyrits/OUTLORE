import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ensureGuildmaster } from "./guildmasterPlace.ts";
import { insertMessage } from "./messaging.ts";
import { isQuestKindOf } from "./questVisibility.ts";

/** Puts the quest's originating message in its channel, keeping an existing anchor's identity. */
export const placeQuestOrigin = Effect.fnUntraced(function* (threadId: string, opening?: string) {
  const sql = yield* SqlClient.SqlClient;
  const [quest] = yield* sql<{ realmId: string | null; messageId: string | null }>`
    SELECT workspace_id AS realmId, anchor_message_id AS messageId FROM threads WHERE id = ${threadId}`;
  if (quest === undefined || (quest.messageId === null && opening === undefined)) return;
  const channel = yield* ensureGuildmaster(quest.realmId);
  if (quest.messageId === null) {
    if (opening === undefined) return;
    const { messageId } = yield* insertMessage({
      fromThreadId: null,
      isConversationOnly: true,
      isQueued: false,
      isResult: false,
      text: opening,
      threadId: channel.threadId,
    });
    yield* sql`UPDATE threads SET anchor_message_id = ${messageId} WHERE id = ${threadId}`;
    return;
  }
  yield* sql`UPDATE messages
    SET thread_id = ${channel.threadId}, mission_id = ${channel.missionId}, is_conversation_only = 1, is_queued = 0,
      sequence = (SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE thread_id = ${channel.threadId})
    WHERE id = ${quest.messageId} AND thread_id <> ${channel.threadId}`;
});

/**
 * Leaves the owner's first message of a quest or errand no Reply started in its parent conversation, where it becomes the
 * thread's anchor: a quest's goes to its channel, an errand's to its quest. It is conversation only, so it wakes and
 * tells no one; the thread answers it. A thread that has an anchor already has its place.
 */
export const copyOpeningToParent = Effect.fnUntraced(function* (threadId: string, text: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ anchorId: string | null; isGuildmaster: number; parentId: string | null }>`
    SELECT t.anchor_message_id AS anchorId, t.parent_id AS parentId, ${isQuestKindOf(sql, "chronicler")} AS isGuildmaster
    FROM threads t JOIN missions m ON m.id = t.mission_id WHERE t.id = ${threadId}`;
  if (thread === undefined || thread.anchorId !== null || thread.isGuildmaster === 1) return;
  if (thread.parentId === null) return yield* placeQuestOrigin(threadId, text);
  const { messageId } = yield* insertMessage({
    fromThreadId: null,
    isConversationOnly: true,
    isQueued: false,
    isResult: false,
    text,
    threadId: thread.parentId,
  });
  yield* sql`UPDATE threads SET anchor_message_id = ${messageId} WHERE id = ${threadId}`;
});

/** Whether no message has been written in the thread yet, as in a quest or errand a Reply or a New quest opened empty. */
export const isUnwritten = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM messages WHERE thread_id = ${threadId}`;
  return row?.count === 0;
});
