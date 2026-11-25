import { type HarnessName, MessageId, type SendToParentScope } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { newId, touchMission } from "../core/index.ts";

/** One message appended at the end of a thread's history, without side effects on chatter or ending. */
export const appendMessage = Effect.fnUntraced(function* (message: {
  readonly missionId: string;
  readonly threadId: string;
  readonly senderKind: "user" | "agent" | "thread" | "system";
  readonly fromThreadId: string | null;
  readonly isConversationOnly?: boolean;
  readonly isResult: boolean;
  readonly isQueued: boolean;
  /** The harness that wrote an agent reply; null otherwise. */
  readonly harness?: HarnessName | null;
  /** The model that wrote an agent reply, as the harness named it; null otherwise. */
  readonly model?: string | null;
  /** The realm's folder the owner attached to the message, for Chronicler; null otherwise. */
  readonly realmPath?: string | null;
  /** The "Also send to" scope when the owner also echoed this message to the parent; null otherwise. */
  readonly sentToParent?: SendToParentScope | null;
  /** Where the owner had Chronicler open from, as the line Chronicler reads with the message; null otherwise. */
  readonly viewing?: string | null;
  readonly text: string;
  readonly now: number;
}) {
  const sql = yield* SqlClient.SqlClient;
  const messageId = MessageId.make(yield* newId);
  const [next] = yield* sql<{ sequence: number }>`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE thread_id = ${message.threadId}`;
  yield* sql`INSERT INTO messages
        (id, mission_id, thread_id, sender_kind, sender_thread_id, is_result, is_queued, text, sequence, sent_at, sender_title, model, harness, realm_path, sent_to_parent, viewing, is_conversation_only)
      VALUES (${messageId}, ${message.missionId}, ${message.threadId}, ${message.senderKind}, ${message.fromThreadId},
        ${message.isResult ? 1 : 0}, ${message.isQueued ? 1 : 0}, ${message.text}, ${next?.sequence ?? 1}, ${message.now},
        (SELECT title FROM threads WHERE id = ${message.fromThreadId}), ${message.model ?? null}, ${message.harness ?? null},
        ${message.realmPath ?? null}, ${message.sentToParent ?? null}, ${message.viewing ?? null}, ${message.isConversationOnly === true ? 1 : 0})`;
  yield* touchMission(message.missionId, message.now);
  return messageId;
});
