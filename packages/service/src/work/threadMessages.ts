import type { Message } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readFrameContexts } from "./companionExchanges.ts";
import { isQuestKindOf } from "./questVisibility.ts";

// Reads the messages of one thread for MissionDetail, attaching cards, Companion frame state, and reply usage.

type MessageRow = Omit<
  Message,
  | "attachments"
  | "companionFrameContext"
  | "companionFrameId"
  | "isCompanionAnswer"
  | "isResult"
  | "isQueued"
  | "isDelivered"
  | "usage"
> & {
  companionFrameId: Message["id"] | null;
  isCompanionAnswer: number;
  isResult: number;
  isDelivered: number;
  isQueued: number;
  usageCacheCreation: number | null;
  usageCacheRead: number | null;
  usageEstimate: number | null;
  usageInput: number | null;
  usageOutput: number | null;
  usageReported: number | null;
};

/** Loads one thread's raw message rows in sequence order. */
export const readThreadMessageRows = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<MessageRow>`
    SELECT m.id, m.thread_id AS threadId, m.reply_to_message_id AS replyToMessageId, m.sender_kind AS sender, m.model, m.harness, m.text, m.sequence, m.sent_at AS sentAt,
      m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle, m.is_result AS isResult,
      EXISTS (SELECT 1 FROM companion_exchanges ce WHERE ce.reply_message_id = m.id) AS isCompanionAnswer,
      COALESCE(
        (SELECT COALESCE(ce.frame_message_id, ce.owner_message_id) FROM companion_exchanges ce WHERE ce.reply_message_id = m.id LIMIT 1),
        (SELECT ce.frame_message_id FROM companion_exchanges ce WHERE ce.owner_message_id = m.id AND ce.frame_message_id IS NOT NULL AND ce.frame_message_id != m.id LIMIT 1)
      ) AS companionFrameId,
      CASE WHEN ${isQuestKindOf(sql, "owner", "sm")} THEN s.mission_id END AS fromMissionId,
      (m.is_queued = 1 AND m.delivered_turn_id IS NULL) AS isQueued, (m.delivered_turn_id IS NOT NULL OR m.is_conversation_only = 1) AS isDelivered,
      ru.input AS usageInput, ru.output AS usageOutput, ru.cache_read AS usageCacheRead,
      ru.cache_creation AS usageCacheCreation, ru.estimate AS usageEstimate, ru.reported AS usageReported
    FROM messages m LEFT JOIN reply_usage ru ON ru.message_id = m.id LEFT JOIN threads s ON s.id = m.sender_thread_id LEFT JOIN missions sm ON sm.id = s.mission_id
    WHERE m.thread_id = ${threadId} ORDER BY m.sequence`;
});

/** Hydrates raw message rows with attachments, Companion frame context state, and usage. */
export const hydrateThreadMessages = Effect.fnUntraced(function* (
  threadId: string,
  rows: ReadonlyArray<MessageRow>,
  cards: ReadonlyMap<string, Message["attachments"]>,
) {
  const frameContextById = yield* readFrameContexts(threadId);
  return rows.map(
    ({
      companionFrameId,
      usageCacheCreation,
      usageCacheRead,
      usageEstimate,
      usageInput,
      usageOutput,
      usageReported,
      ...message
    }): Message => {
      const companionFrameContext = frameContextById.get(message.id);
      return {
        ...message,
        attachments: cards.get(message.id) ?? [],
        ...(companionFrameContext === undefined ? {} : { companionFrameContext }),
        ...(companionFrameId === null ? {} : { companionFrameId }),
        isCompanionAnswer: message.isCompanionAnswer === 1,
        isDelivered: message.isDelivered === 1,
        isQueued: message.isQueued === 1,
        isResult: message.isResult === 1,
        usage:
          usageInput === null
            ? null
            : {
                estimated: usageEstimate,
                reported: usageReported,
                tokens: {
                  cacheCreation: usageCacheCreation ?? 0,
                  cacheRead: usageCacheRead ?? 0,
                  input: usageInput,
                  output: usageOutput ?? 0,
                },
              },
      };
    },
  );
});
