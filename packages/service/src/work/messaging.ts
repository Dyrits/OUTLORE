import { type HarnessName, MessageId, type SendMessageResult } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, newId, notFound, touchMission } from "../core/index.ts";
import { attachToMessage, readStoredAttachments, type StoredAttachment } from "./attachments.ts";
import { resetOwnerChatter, resetResultChatter } from "./chatter.ts";
import { isOwnerMessageOf, readMentionNote } from "./mentions.ts";
import { requireActiveQuestRealm } from "./realmAccess.ts";
import { addSkillInstructions, listSkills } from "./skills.ts";
import { readThreadWorkspace } from "./workspaces.ts";

// The thread inbox: a thread's message history and what waits to be delivered to it (thread-messaging).
// It alone writes messages, assigns their order, and marks them delivered.

/** One message appended at the end of a thread's history, without side effects on chatter or ending. */
const appendMessage = (message: {
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
  /** Where the owner had Chronicler open from, as the line Chronicler reads with the message; null otherwise. */
  readonly viewing?: string | null;
  readonly text: string;
  readonly now: number;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const messageId = MessageId.make(yield* newId);
    const [next] = yield* sql<{ sequence: number }>`
      SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM messages WHERE thread_id = ${message.threadId}`;
    yield* sql`INSERT INTO messages
        (id, mission_id, thread_id, sender_kind, sender_thread_id, is_result, is_queued, text, sequence, sent_at, sender_title, model, harness, realm_path, viewing, is_conversation_only)
      VALUES (${messageId}, ${message.missionId}, ${message.threadId}, ${message.senderKind}, ${message.fromThreadId},
        ${message.isResult ? 1 : 0}, ${message.isQueued ? 1 : 0}, ${message.text}, ${next?.sequence ?? 1}, ${message.now},
        (SELECT title FROM threads WHERE id = ${message.fromThreadId}), ${message.model ?? null}, ${message.harness ?? null},
        ${message.realmPath ?? null}, ${message.viewing ?? null}, ${message.isConversationOnly === true ? 1 : 0})`;
    yield* touchMission(message.missionId, message.now);
    return messageId;
  });

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
      WHERE m.thread_id = ${threadId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL AND m.is_conversation_only = 0
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

/** The mission's threads, other than `exceptThreadId`, with messages waiting that could start a turn. */
export const listThreadsWithPending = Effect.fnUntraced(function* (missionId: string, exceptThreadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ threadId: string }>`
      SELECT DISTINCT m.thread_id AS threadId FROM messages m JOIN threads t ON t.id = m.thread_id
      WHERE m.mission_id = ${missionId} AND m.sender_kind IN ('user', 'thread') AND m.delivered_turn_id IS NULL AND m.is_conversation_only = 0
        AND t.state NOT IN ('Running', 'Attention', 'Stopped', 'Failed') AND t.id != ${exceptThreadId}`;
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
  /** Whether it waits for the receiver's next turn instead of joining a running one (CHG-0039). */
  readonly isConversationOnly?: boolean;
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

/** Records a message for a thread, after the thread's existing messages. Callers run it in a transaction. */
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
  const messageId = yield* appendMessage({
    ...recorded,
    missionId: thread.missionId,
    now: yield* Clock.currentTimeMillis,
    senderKind: message.fromThreadId === null ? "user" : "thread",
  });
  yield* attachToMessage(messageId, attachmentIds);
  return messageId;
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
  }).pipe(Effect.map((messageId) => ({ messageId }) satisfies SendMessageResult));

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
