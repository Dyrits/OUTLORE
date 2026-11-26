import type { HarnessName, SendMessageResult, SendToParentScope } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { attachToMessage } from "./attachments.ts";
import { resetOwnerChatter, resetResultChatter } from "./chatter.ts";
import { appendMessage } from "./messageStorage.ts";
import { requireActiveQuestRealm } from "./realmAccess.ts";

// The thread inbox routes messages and tracks what still waits for delivery (thread-messaging).

/** Records an agent's reply in its thread. Callers run it in a transaction. */
export const insertReply = Effect.fnUntraced(function* (
  missionId: string,
  threadId: string,
  text: string,
  written: { readonly harness: HarnessName; readonly model: string | null },
) {
  const now = yield* Clock.currentTimeMillis;
  return yield* appendMessage({
    fromThreadId: null,
    harness: written.harness,
    isQueued: false,
    isResult: false,
    missionId,
    model: written.model,
    now,
    senderKind: "agent",
    text,
    threadId,
  });
});

/** Records the agent reply that anchors an errand, without queuing it for delivery. */
export const insertErrandReply = Effect.fnUntraced(function* (
  openerId: string,
  brief: string,
  replyToId: string | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const [opener] = yield* sql<{ missionId: string; harness: HarnessName; model: string | null }>`
    SELECT mission_id AS missionId, harness, model FROM threads WHERE id = ${openerId}`;
  if (opener === undefined) return yield* notFound("No such thread.");
  const [target] =
    replyToId === null
      ? yield* sql<{ id: string }>`SELECT id FROM messages WHERE thread_id = ${openerId} ORDER BY sequence DESC LIMIT 1`
      : yield* sql<{ id: string }>`SELECT id FROM messages WHERE thread_id = ${openerId} AND id = ${replyToId}`;
  if (replyToId !== null && target === undefined) return yield* invalid("No such message in this conversation.");
  const id = yield* appendMessage({
    fromThreadId: null,
    harness: opener.harness,
    isQueued: false,
    isResult: false,
    missionId: opener.missionId,
    model: opener.model,
    now: yield* Clock.currentTimeMillis,
    senderKind: "agent",
    text: brief,
    threadId: openerId,
  });
  if (target !== undefined) yield* sql`UPDATE messages SET reply_to_message_id = ${target.id} WHERE id = ${id}`;
  return id;
});

/** A message to record in a thread: from the owner, or from another thread of its mission. */
type NewMessage = {
  /** The files the owner attached, added beforehand as drafts (message-attachments). */
  readonly attachmentIds?: ReadonlyArray<string>;
  /** The sending thread, for a thread message. */
  readonly fromThreadId: string | null;
  /** Whether the message belongs only to the conversation history. */
  readonly isConversationOnly?: boolean;
  /** Whether the message waits for the receiver's next turn instead of joining a running one (CHG-0039). */
  readonly isQueued: boolean;
  /** Whether it is a result reported by a thread beneath (thread-tree, Results). */
  readonly isResult: boolean;
  /** The realm's folder the owner attached, for Chronicler (quest coordination). */
  readonly realmPath?: string | null;
  /** The "Also send to" scope when the owner also echoed this message to the parent. */
  readonly sentToParent?: SendToParentScope | null;
  readonly text: string;
  readonly threadId: string;
  /** Where the owner had Chronicler open from, as the line Chronicler reads with the message. */
  readonly viewing?: string | null;
};

/** Records a message and returns its receiver wake for the caller to apply after commit. */
export const insertMessage = Effect.fnUntraced(function* (message: NewMessage) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{
    missionId: string;
    archivedAt: number | null;
    state: string;
  }>`SELECT mission_id AS missionId, archived_at AS archivedAt, state FROM threads
    WHERE id = ${message.threadId} AND is_deleting = 0`;
  if (thread === undefined) return yield* notFound("No such thread.");
  if (thread.archivedAt !== null) return yield* invalid("This errand is archived. Restore it to write in it.");
  yield* requireActiveQuestRealm(thread.missionId);
  if (message.fromThreadId === null) {
    yield* resetOwnerChatter(message.threadId);
    // The owner writing in a Done or archived mission continues it; its threads record what follows
    // in the journal (mission-tracking, Ending a mission).
    yield* sql`UPDATE missions SET ending = NULL WHERE id = ${thread.missionId} AND ending IS NOT NULL`;
  } else if (message.isResult) yield* resetResultChatter(message.fromThreadId, message.threadId);
  const { attachmentIds = [], ...recorded } = message;
  if (message.isConversationOnly !== true) {
    // A Ritual's conversation is its run history (CHG-0616): there is no composer and no thread writes to it. Only
    // the service's run lines and run errands' reports land there, and those keep to the conversation.
    const [ritual] = yield* sql<{ id: string }>`SELECT r.id FROM rituals r
        JOIN missions m ON m.id = r.mission_id WHERE m.top_thread_id = ${message.threadId}`;
    if (ritual !== undefined)
      return yield* invalid(
        "A Ritual's conversation is its runs' history: there is no writing to it. Change the Ritual in its panel, or run it again.",
      );
  }
  const messageId = yield* appendMessage({
    ...recorded,
    missionId: thread.missionId,
    now: yield* Clock.currentTimeMillis,
    senderKind: message.fromThreadId === null ? "user" : "thread",
  });
  yield* attachToMessage(messageId, attachmentIds);
  // A new message continues a Fulfilled thread even if it has to wait for a running slot.
  // The write is guarded so an ordinary message never touches the threads row: a threads write during a running turn can let a connector tool switched off in that turn run after all (gatewayCalls).
  if (message.isConversationOnly !== true && thread.state === "Fulfilled") {
    yield* sql`UPDATE threads SET state = 'Resting' WHERE id = ${message.threadId} AND state = 'Fulfilled'`;
  }
  // User and thread messages start out undelivered. Conversation-only entries never reach admission.
  const threadsToWake: ReadonlyArray<string> = message.isConversationOnly === true ? [] : [message.threadId];
  return { messageId, threadsToWake };
});

/** Records an owner message for a thread, queued or to steer a running turn. Callers run it in a transaction. */
export const insertUserMessage = (
  threadId: string,
  text: string,
  isQueued: boolean,
  attachmentIds: ReadonlyArray<string> = [],
  realmPath: string | null = null,
  viewing: string | null = null,
  sentToParent: SendToParentScope | null = null,
) =>
  insertMessage({
    attachmentIds,
    fromThreadId: null,
    isQueued,
    isResult: false,
    realmPath,
    sentToParent,
    text,
    threadId,
    viewing,
  }).pipe(
    Effect.map(({ messageId, threadsToWake }) => ({ threadsToWake, value: { messageId } satisfies SendMessageResult })),
  );
