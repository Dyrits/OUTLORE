import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ensureGuildmaster } from "./guildmasterPlace.ts";
import { insertMessage } from "./messaging.ts";

/** Puts the quest's originating message in its channel, keeping an existing anchor's identity. */
export const placeQuestOrigin = Effect.fnUntraced(function* (threadId: string, opening?: string) {
  const sql = yield* SqlClient.SqlClient;
  const [quest] = yield* sql<{ realmId: string | null; messageId: string | null }>`
    SELECT workspace_id AS realmId, anchor_message_id AS messageId FROM threads WHERE id = ${threadId}`;
  if (quest === undefined || (quest.messageId === null && opening === undefined)) return;
  const channel = yield* ensureGuildmaster(quest.realmId);
  if (quest.messageId === null) {
    if (opening === undefined) return;
    const id = yield* insertMessage({
      fromThreadId: null,
      isConversationOnly: true,
      isQueued: false,
      isResult: false,
      text: opening,
      threadId: channel.threadId,
    });
    yield* sql`UPDATE threads SET anchor_message_id = ${id} WHERE id = ${threadId}`;
    return;
  }
  yield* sql`UPDATE messages
    SET thread_id = ${channel.threadId}, mission_id = ${channel.missionId}, is_conversation_only = 1, is_queued = 0,
      sequence = (SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE thread_id = ${channel.threadId})
    WHERE id = ${quest.messageId} AND thread_id <> ${channel.threadId}`;
});

/** An empty quest gets its channel origin when the owner writes its opening message. */
export const recordFirstQuestMessage = Effect.fnUntraced(function* (threadId: string, messageId: string, text: string) {
  const sql = yield* SqlClient.SqlClient;
  const [opening] = yield* sql`
    SELECT m.id FROM missions m JOIN threads top ON top.id = m.top_thread_id
    WHERE top.id = ${threadId} AND m.is_guildmaster = 0 AND top.anchor_message_id IS NULL
      AND NOT EXISTS (SELECT 1 FROM messages WHERE thread_id = top.id AND sender_kind = 'user' AND id <> ${messageId})
      AND NOT EXISTS (SELECT 1 FROM rituals WHERE mission_id = m.id)`;
  if (opening !== undefined) yield* placeQuestOrigin(threadId, text);
});
