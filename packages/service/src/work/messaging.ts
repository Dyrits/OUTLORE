import type { HarnessName, SendMessageResult } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { attachToMessage, readStoredAttachments, type StoredAttachment } from "./attachments.ts";
import { resetOwnerChatter, resetResultChatter } from "./chatter.ts";
import { isOwnerMessageOf, readMentionNote } from "./mentions.ts";
import { appendMessage } from "./messageStorage.ts";
import { requireActiveQuestRealm } from "./realmAccess.ts";
import { addSkillInstructions, listSkills } from "./skills.ts";
import { readThreadWorkspace } from "./workspaces.ts";

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

/** A message waiting to be delivered, as its receiver's harness reads it. */
export type PendingMessage = {
  /** The files attached to it, in order (message-attachments). */
  readonly attachments: ReadonlyArray<StoredAttachment>;
  readonly id: string;
  readonly text: string;
};

/**
 * The thread's messages from the owner and other threads not yet delivered, in order; with `isSteering`,
 * only those that may join a running turn (queued owner messages wait for the next one; CHG-0039).
 */
export const listPending = Effect.fnUntraced(function* (threadId: string, isSteering: boolean) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    id: string;
    text: string;
    fromThreadId: string | null;
    fromTitle: string | null;
    isResult: number;
    isOwner: number;
    realmName: string | null;
    realmPath: string | null;
    viewing: string | null;
  }>`
      SELECT m.id, m.text, m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle,
        m.is_result AS isResult, (${isOwnerMessageOf(sql)}) AS isOwner,
        m.realm_path AS realmPath, w.name AS realmName, m.viewing AS viewing
      FROM messages m LEFT JOIN threads s ON s.id = m.sender_thread_id LEFT JOIN workspaces w ON w.path = m.realm_path
      WHERE m.thread_id = ${threadId} AND ${isPendingDeliveryOf(sql)}
        AND ${isSteering ? sql`m.is_queued = 0` : sql`1 = 1`}
      ORDER BY m.sequence`;
  // The owner's slash-names become pointers to the skills' instructions, as the thread's workspace sees them.
  const skills = rows.some((row) => row.fromThreadId === null && row.text.includes("/"))
    ? yield* listSkills((yield* readThreadWorkspace(threadId))?.path ?? null)
    : [];
  const attachments = yield* readStoredAttachments(rows.map((row) => row.id));
  return yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      // The owner's `@` mentions of quests, errands, and realms are resolved as they are delivered (CHG-0181).
      const note = row.isOwner === 1 ? yield* readMentionNote(row.text) : "";
      return {
        attachments: attachments.get(row.id) ?? [],
        id: row.id,
        text: deliveredTextOf({
          ...row,
          isResult: row.isResult === 1,
          realm: row.realmPath === null ? null : { name: row.realmName ?? row.realmPath, path: row.realmPath },
          text: row.fromThreadId === null ? `${addSkillInstructions(row.text, skills)}${note}` : row.text,
          viewing: row.viewing,
        }),
      } satisfies PendingMessage;
    }),
  );
});

/**
 * What makes a message a delivery still waiting for a turn (thread-messaging): an owner or thread message that no
 * turn has delivered and that is not conversation-only. One fragment for every reading, so a new sender kind or
 * flag changes here alone.
 */
export const isPendingDeliveryOf = (sql: SqlClient.SqlClient) =>
  sql`m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL AND m.is_conversation_only = 0`;

/** The mission's threads, other than `exceptThreadId`, with messages waiting that could start a turn. */
export const listThreadsWithPending = Effect.fnUntraced(function* (missionId: string, exceptThreadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ threadId: string }>`
      SELECT DISTINCT m.thread_id AS threadId FROM messages m JOIN threads t ON t.id = m.thread_id
      WHERE m.mission_id = ${missionId} AND ${isPendingDeliveryOf(sql)}
        AND t.state NOT IN ('Underway', 'Attention', 'Stopped', 'Failed') AND t.id != ${exceptThreadId}`;
  return rows.map((row) => row.threadId);
});

/** Marks messages as delivered to a turn; one already delivered keeps its turn. Callers run it in a transaction. */
export const deliverMessages = Effect.fnUntraced(function* (messageIds: ReadonlyArray<string>, turnId: string) {
  const sql = yield* SqlClient.SqlClient;
  if (messageIds.length === 0) return;
  yield* sql`UPDATE messages SET delivered_turn_id = ${turnId}
      WHERE id IN ${sql.in(messageIds)} AND delivered_turn_id IS NULL`;
});

/**
 * Lets a queued owner message join its thread's running turn: it is no longer queued, so the turn may take it in.
 * Returns the thread, or refuses when the message was already delivered or was never queued. Callers run it in a transaction.
 */
export const releaseQueued = Effect.fnUntraced(function* (messageId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [message] = yield* sql<{ threadId: string }>`
    UPDATE messages SET is_queued = 0
    WHERE id = ${messageId} AND sender_kind = 'user' AND is_queued = 1 AND delivered_turn_id IS NULL
    RETURNING thread_id AS threadId`;
  if (message === undefined) return yield* invalid("This message is no longer queued.");
  return message.threadId;
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
  }>`SELECT mission_id AS missionId, archived_at AS archivedAt FROM threads
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
) =>
  insertMessage({
    attachmentIds,
    fromThreadId: null,
    isQueued,
    isResult: false,
    realmPath,
    text,
    threadId,
    viewing,
  }).pipe(
    Effect.map(({ messageId, threadsToWake }) => ({ threadsToWake, value: { messageId } satisfies SendMessageResult })),
  );

/** A message as the receiving thread's harness reads it: a thread message names its sender. */
const deliveredTextOf = (message: {
  readonly fromThreadId: string | null;
  readonly fromTitle: string | null;
  readonly isResult: boolean;
  readonly realm: { readonly name: string; readonly path: string } | null;
  readonly text: string;
  readonly viewing: string | null;
}) =>
  message.fromThreadId === null && message.fromTitle === null
    ? [
        message.text,
        ...(message.realm === null
          ? []
          : [
              `[The owner chose the realm "${message.realm.name}" (${message.realm.path}) for this message: any new quest opens there.]`,
            ]),
        ...(message.viewing === null
          ? []
          : [`[The owner wrote this with ${message.viewing} open: "this quest" or "this page" means it.]`]),
      ].join("\n\n")
    : `${message.isResult ? "Result" : "Message"} from thread "${message.fromTitle ?? ""}" (${message.fromThreadId ?? "deleted"}):\n${message.text}`;
