import { hasMark, type SendToParentScope } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";
import { readStoredAttachments, type StoredAttachment } from "./attachments.ts";
import { isOwnerMessageOf, readMentionNote } from "./mentions.ts";
import { isNotArchivedErrandOf } from "./questVisibility.ts";
import { addSkillInstructions, listSkills } from "./skills.ts";
import { readThreadWorkspace } from "./workspaces.ts";

// The messages that still wait for delivery to a thread, and how a harness reads them (thread-messaging).

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
    hasParent: number;
    isResult: number;
    isOwner: number;
    realmName: string | null;
    realmPath: string | null;
    sentToParent: SendToParentScope | null;
    viewing: string | null;
  }>`
      SELECT m.id, m.text, m.sender_thread_id AS fromThreadId, COALESCE(s.title, m.sender_title) AS fromTitle,
        (t.parent_id IS NOT NULL) AS hasParent, m.is_result AS isResult, (${isOwnerMessageOf(sql)}) AS isOwner,
        m.realm_path AS realmPath, w.name AS realmName, m.sent_to_parent AS sentToParent, m.viewing AS viewing
      FROM messages m JOIN threads t ON t.id = m.thread_id
        LEFT JOIN threads s ON s.id = m.sender_thread_id LEFT JOIN workspaces w ON w.path = m.realm_path
      WHERE m.thread_id = ${threadId} AND ${isPendingDeliveryOf(sql)}
        AND ${isSteering ? sql`m.is_queued = 0` : sql`1 = 1`}
      ORDER BY m.sequence`;
  // The owner's `$`-names become pointers to the skills' instructions, as the thread's workspace sees them.
  const skills = rows.some((row) => row.fromThreadId === null && hasMark(row.text, "skill"))
    ? yield* listSkills((yield* readThreadWorkspace(threadId))?.path ?? null)
    : [];
  const attachments = yield* readStoredAttachments(rows.map((row) => row.id));
  return yield* Effect.forEach(
    rows,
    Effect.fnUntraced(function* (row) {
      // The owner's `#` mentions of quests, errands, and realms are resolved as they are delivered (CHG-0181).
      const note = row.isOwner === 1 ? yield* readMentionNote(row.text) : "";
      return {
        attachments: attachments.get(row.id) ?? [],
        id: row.id,
        text: deliveredTextOf({
          ...row,
          hasParent: row.hasParent === 1,
          isResult: row.isResult === 1,
          realm: row.realmPath === null ? null : { name: row.realmName ?? row.realmPath, path: row.realmPath },
          sentToParent: row.sentToParent,
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
        AND t.state NOT IN ('Underway', 'Attention', 'Stopped', 'Failed', 'Fulfilled')
        AND ${isNotArchivedErrandOf(sql)} AND t.id != ${exceptThreadId}`;
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

/**
 * Returns a steered owner message to the queue, so it waits for the next turn instead of joining the running one.
 * Refuses when the running turn has already taken the message in, or when it is not steered. Callers run it in a transaction.
 */
export const requeueSteered = Effect.fnUntraced(function* (messageId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [message] = yield* sql<{ threadId: string }>`
    UPDATE messages SET is_queued = 1
    WHERE id = ${messageId} AND sender_kind = 'user' AND is_queued = 0
      AND delivered_turn_id IS NULL AND is_conversation_only = 0
    RETURNING thread_id AS threadId`;
  if (message === undefined) return yield* invalid("This message was already taken in by the running turn.");
  return message.threadId;
});

/** The note appended to an owner message when the owner also sent it to the parent ("Also send to"). */
const sentToParentNoteOf = (scope: SendToParentScope, hasParent: boolean) =>
  hasParent
    ? scope === "FullContext"
      ? '[The owner also sent this message with this thread\'s conversation to your parent thread ("Also send to").]'
      : '[The owner also sent this message to your parent thread ("Also send to").]'
    : '[The owner also posted this message to the channel ("Also send to") without waking Chronicler.]';

/** A message as the receiving thread's harness reads it: a thread message names its sender. */
const deliveredTextOf = (message: {
  readonly fromThreadId: string | null;
  readonly fromTitle: string | null;
  readonly hasParent: boolean;
  readonly isResult: boolean;
  readonly realm: { readonly name: string; readonly path: string } | null;
  readonly sentToParent: SendToParentScope | null;
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
        ...(message.sentToParent === null ? [] : [sentToParentNoteOf(message.sentToParent, message.hasParent)]),
        ...(message.viewing === null
          ? []
          : [`[The owner wrote this with ${message.viewing} open: "this quest" or "this page" means it.]`]),
      ].join("\n\n")
    : `${message.isResult ? "Result" : "Message"} from thread "${message.fromTitle ?? ""}" (${message.fromThreadId ?? "deleted"}):\n${message.text}`;
