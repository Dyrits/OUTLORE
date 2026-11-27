import type {
  BackupCompanion,
  HarnessName,
  OpenThreadResult,
  ThreadId,
  ThreadPermissionMode,
} from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, newId, notFound } from "../core/index.ts";
import { checkAccount, checkBackups, type Runner, type RunnerChoice, runnerOf } from "../harness/index.ts";
import { budgetRefusalOf } from "./budgetScopes.ts";
import { changed, unchanged } from "./followUps.ts";
import { type JournalAuthor, nothingToRecord, openerMessagesOf, openerTailOf, updateJournal } from "./journal.ts";
import { maxOwnerDepth } from "./lifecycle.ts";
import { insertErrandReply, insertMessage, insertReply } from "./messaging.ts";
import { ownCopyForChild } from "./ownCopies.ts";
import { withThreadContext } from "./parentEcho.ts";
import { copyOpeningToParent } from "./questOrigins.ts";
import { isNotBeingDeletedOf, isQuestStandingOf } from "./questVisibility.ts";
import { readStartingContext, startingContextRefusalOf } from "./startingContextSizing.ts";
import { newErrandTitle, titleOf } from "./titles.ts";
import { depthOf, maxRunning, runningCountOf } from "./treeLimits.ts";

type Opening = {
  /** The files attached to the first message, added beforehand as drafts (message-attachments). */
  readonly attachmentIds?: ReadonlyArray<string>;
  /** A chosen preset replaces the parent's backups, including with an empty list; null inherits them. */
  readonly backups: ReadonlyArray<BackupCompanion> | null;
  /** The opener's choices; what it leaves out comes from the parent (runnerOf). */
  readonly choice: RunnerChoice;
  /** The message this thread hangs from: the one the owner replied to. Null for an agent's errand, which gets an agent reply of its own. */
  readonly anchorMessageId?: string | null;
  /** An off-topic request the owner kept beneath the thread (thread-tree, Off-topic requests). */
  readonly replyToMessageId?: string | null;
  readonly isAside: boolean;
  readonly isOpenedByAgent: boolean;
  /** Whether the thread gets an own copy of its own (workspace-attachment); otherwise it shares its parent's, if any. */
  readonly isOwnCopyAsked: boolean;
  readonly parentId: string;
  readonly text: string;
  /** A short title the opener gave; null leaves the errand called "Errand" until it names itself. */
  readonly title: string | null;
};

/** The parent's runner and where it works, or undefined when it is gone. */
const readParent = Effect.fnUntraced(function* (parentId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [parent] = yield* sql<
    Runner & {
      backups: string;
      missionId: string;
      permissionMode: ThreadPermissionMode | null;
      workspaceId: string | null;
    }
  >`SELECT mission_id AS missionId, harness, account_id AS accountId, model, effort, workspace_id AS workspaceId, backups, permission_mode AS permissionMode
      FROM threads WHERE id = ${parentId} AND ${isNotBeingDeletedOf(sql, "threads")}`;
  return parent;
});

/**
 * Resolves the anchor message for an agent-opened errand: a single errand anchors directly to the triggering message
 * with no extra bubble, while multiple errands on the same message each get their own agent brief reply so none is
 * asymmetrically tied to an umbrella message.
 */
const resolveAgentAnchor = Effect.fnUntraced(function* (
  parentId: string,
  brief: string,
  replyToMessageId: string | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const [target] =
    replyToMessageId === null
      ? yield* sql<{ id: string; replyToMessageId: string | null }>`
          SELECT id, reply_to_message_id AS replyToMessageId FROM messages
          WHERE thread_id = ${parentId} ORDER BY sequence DESC LIMIT 1`
      : yield* sql<{ id: string; replyToMessageId: string | null }>`
          SELECT id, reply_to_message_id AS replyToMessageId FROM messages
          WHERE thread_id = ${parentId} AND id = ${replyToMessageId}`;
  if (target === undefined) return yield* insertErrandReply(parentId, brief, replyToMessageId);
  // If the latest message is already an agent brief from a multi-errand split, keep sibling briefs tied to its trigger.
  if (replyToMessageId === null && target.replyToMessageId !== null) {
    const [splitErrand] = yield* sql<{ id: string }>`
      SELECT id FROM threads WHERE anchor_message_id = ${target.id} AND is_opened_by_agent = 1 AND ${isNotBeingDeletedOf(sql, "threads")} LIMIT 1`;
    if (splitErrand !== undefined) return yield* insertErrandReply(parentId, brief, target.replyToMessageId);
  }
  const [existing] = yield* sql<{ id: string; isOpenedByAgent: number }>`
    SELECT id, is_opened_by_agent AS isOpenedByAgent FROM threads
    WHERE anchor_message_id = ${target.id} AND ${isNotBeingDeletedOf(sql, "threads")} LIMIT 1`;
  const [existingSplit] = yield* sql<{ id: string }>`
    SELECT t.id FROM threads t JOIN messages m ON m.id = t.anchor_message_id
    WHERE m.thread_id = ${parentId} AND m.reply_to_message_id = ${target.id}
      AND t.is_opened_by_agent = 1 AND ${isNotBeingDeletedOf(sql)} LIMIT 1`;
  if (existing === undefined && existingSplit === undefined) return target.id;
  if (existing !== undefined && existing.isOpenedByAgent === 1) {
    const [firstMessage] = yield* sql<{ text: string }>`
      SELECT text FROM messages WHERE thread_id = ${existing.id} ORDER BY sequence ASC LIMIT 1`;
    const existingReplyId = yield* insertErrandReply(parentId, firstMessage?.text ?? "", target.id);
    yield* sql`UPDATE threads SET anchor_message_id = ${existingReplyId} WHERE id = ${existing.id}`;
  }
  return yield* insertErrandReply(parentId, brief, target.id);
});

/**
 * Records a thread beneath the parent, in the parent's workspace and, unless chosen, with its harness,
 * account, model, effort, and backup Companions, and its first message: the opener's request. The command that opens it wakes
 * it. The errand starts with the parent’s permission setting.
 */
const recordThread = Effect.fnUntraced(function* (opening: Opening) {
  const sql = yield* SqlClient.SqlClient;
  const parent = yield* readParent(opening.parentId);
  if (parent === undefined) return yield* notFound("No such thread.");
  const runner = yield* checkAccount(runnerOf(parent, opening.choice));
  if (opening.backups !== null) yield* checkBackups(opening.backups);
  const backups = opening.backups === null ? parent.backups : JSON.stringify(opening.backups);
  const threadId = yield* newId;
  // An aside starts from the off-topic request alone, without its opener's conversation.
  const openerMessages = opening.isAside ? null : yield* openerMessagesOf(opening.parentId);
  // Only a thread the owner opens with a message of its own leans on the conversation around it: an agent's request is
  // meant to be complete, and a Reply's anchored message is its context.
  const openerTail =
    opening.isAside || opening.isOpenedByAgent || opening.anchorMessageId != null
      ? null
      : yield* openerTailOf(opening.parentId);
  const ownCopy = yield* ownCopyForChild(opening.parentId, threadId, opening.isOwnCopyAsked);
  yield* sql`INSERT INTO threads (id, mission_id, parent_id, state, harness, account_id, model, effort, workspace_id, title, is_opened_by_agent, opener_messages, opener_tail, is_aside, backups, own_copy, own_copy_branch, permission_mode)
      VALUES (${threadId}, ${parent.missionId}, ${opening.parentId}, 'Resting', ${runner.harness}, ${runner.accountId},
        ${runner.model}, ${runner.effort}, ${parent.workspaceId}, ${titleOf(opening.title ?? "") || newErrandTitle}, ${opening.isOpenedByAgent ? 1 : 0},
        ${openerMessages}, ${openerTail}, ${opening.isAside ? 1 : 0}, ${backups}, ${ownCopy?.path ?? null}, ${ownCopy?.branch ?? null}, ${parent.permissionMode})`;
  // The errand's anchor: the message the owner replied to, or the triggering message (split on multiple errands).
  const anchorId =
    opening.anchorMessageId ??
    (opening.isOpenedByAgent && !opening.isAside
      ? yield* resolveAgentAnchor(opening.parentId, opening.text, opening.replyToMessageId ?? null)
      : null);
  if (anchorId !== null) yield* sql`UPDATE threads SET anchor_message_id = ${anchorId} WHERE id = ${threadId}`;
  return threadId as ThreadId;
});

/** Records the thread and then its first message, which the command that opens it wakes it with. */
export const insertThread = Effect.fnUntraced(function* (opening: Opening) {
  const threadId = yield* recordThread(opening);
  const { messageId, threadsToWake } = yield* insertMessage({
    fromThreadId: opening.isOpenedByAgent ? opening.parentId : null,
    isQueued: false,
    isResult: false,
    text: opening.text,
    threadId,
    ...(opening.attachmentIds === undefined ? {} : { attachmentIds: opening.attachmentIds }),
  });
  return { messageId, threadId, threadsToWake } satisfies OpenThreadResult & {
    threadsToWake: ReadonlyArray<string>;
  };
});

/** Refuses an errand the owner may not open beneath the parent, from where it stands or the context it would start with. */
const checkOwnerOpening = Effect.fnUntraced(function* (
  parentId: string,
  text: string,
  choice: RunnerChoice & { readonly model: string },
  shouldStartAnyway: boolean,
  anchorMessageId: string | null,
) {
  const sql = yield* SqlClient.SqlClient;
  // A Ritual opens no errands by hand; its runs are the errands (CHG-0616).
  const [beneathRitual] = yield* sql<{ id: string }>`SELECT r.id FROM rituals r
      JOIN missions m ON m.id = r.mission_id WHERE m.top_thread_id = ${parentId}`;
  if (beneathRitual !== undefined)
    return yield* invalid("A Ritual opens no errands by hand: its runs are the errands. Run the Ritual again.");
  if ((yield* depthOf(parentId)) + 1 > maxOwnerDepth) {
    return yield* invalid("Open an errand from the quest conversation.");
  }
  if (anchorMessageId !== null) {
    const [anchor] = yield* sql<{ id: string }>`
      SELECT id FROM messages WHERE id = ${anchorMessageId} AND thread_id = ${parentId}`;
    if (anchor === undefined) return yield* notFound("No such message in this conversation.");
  }
  if (!shouldStartAnyway) {
    const refusal = startingContextRefusalOf(
      yield* readStartingContext(parentId, { harness: choice.harness ?? null, model: choice.model }, text),
    );
    if (refusal !== null) return yield* invalid(refusal);
  }
});

/**
 * The owner opens an errand directly beneath a quest. One whose starting context is over
 * the warning starts only when the owner chose to start it anyway; the new thread is then woken.
 */
export const openThreadByOwner = Effect.fnUntraced(function* (
  parentId: string,
  text: string,
  choice: RunnerChoice & { readonly model: string },
  shouldStartAnyway: boolean,
  attachmentIds: ReadonlyArray<string> = [],
  backups: ReadonlyArray<BackupCompanion> | null = null,
  anchorMessageId: string | null = null,
) {
  yield* checkOwnerOpening(parentId, text, choice, shouldStartAnyway, anchorMessageId);
  const opened = yield* insertThread({
    anchorMessageId,
    attachmentIds,
    backups,
    choice,
    isAside: false,
    isOpenedByAgent: false,
    isOwnCopyAsked: false,
    parentId,
    text,
    title: null,
  });
  // An errand no Reply started leaves its first message in the quest, where it becomes the anchor.
  if (anchorMessageId === null) yield* copyOpeningToParent(opened.threadId, text);
  const { threadsToWake, ...value } = opened;
  return changed(value, { threadsToWake });
});

/**
 * The owner opens an errand beneath a quest from a message, with no first message yet: it is written in the errand's
 * own composer. Nothing wakes it; its context is the quest's at this moment.
 */
export const openEmptyThreadByOwner = Effect.fnUntraced(function* (
  parentId: string,
  choice: RunnerChoice & { readonly model: string },
  anchorMessageId: string,
) {
  // No turn starts yet, so do not block opening the empty errand on the 25% starting-context limit; the owner can pick a larger Companion or trim lore before sending.
  yield* checkOwnerOpening(parentId, "", choice, true, anchorMessageId);
  return yield* recordThread({
    anchorMessageId,
    backups: null,
    choice,
    isAside: false,
    isOpenedByAgent: false,
    isOwnCopyAsked: false,
    parentId,
    text: "",
    title: null,
  });
});

/**
 * Keeps an off-topic request as an aside beneath the thread: its first message is the owner's request, and
 * the aside is then woken.
 */
export const openAside = Effect.fnUntraced(function* (parentId: string, text: string, title: string) {
  if ((yield* depthOf(parentId)) > 0) return yield* invalid("Open an aside from the quest conversation.");
  const opened = yield* insertThread({
    backups: null,
    choice: {},
    isAside: true,
    isOpenedByAgent: false,
    isOwnCopyAsked: false,
    parentId,
    text,
    title: title.trim() === "" ? null : title,
  });
  const { threadsToWake, ...value } = opened;
  return changed(value, { threadsToWake });
});

/** Whether the thread is an aside, which leaves the journal to its parent. */
export const isAside = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`SELECT id FROM threads WHERE id = ${threadId} AND is_aside = 1`;
  return rows.length > 0;
});

/** What `open_thread` came to: the new thread, or why it was refused. */
export type OpenedByAgent =
  | { readonly _tag: "Opened"; readonly threadId: ThreadId }
  | { readonly _tag: "FollowUp" }
  | { readonly _tag: "Refused"; readonly reason: string };

/** A refused `open_thread`, which changes nothing. */
export const refusedOf = (reason: string) => unchanged<OpenedByAgent>({ _tag: "Refused", reason });

/**
 * A thread opens a thread beneath itself (`open_thread`): the new thread's identifier, woken once committed,
 * or the reason it is refused.
 */
export const openThreadByAgent = Effect.fnUntraced(function* (
  callerId: string,
  request: string,
  title: string | null,
  choice: RunnerChoice & { readonly harness: HarnessName | null },
  isOwnCopyAsked = false,
  replyToMessageId: string | null = null,
) {
  const sql = yield* SqlClient.SqlClient;
  const [caller] = yield* sql<{
    accountId: string | null;
    questThreadId: string;
    parentId: string | null;
    harness: HarnessName;
    missionId: string;
  }>`SELECT t.mission_id AS missionId, t.harness, t.account_id AS accountId, t.parent_id AS parentId, m.top_thread_id AS questThreadId
    FROM threads t JOIN missions m ON m.id = t.mission_id WHERE t.id = ${callerId} AND ${isNotBeingDeletedOf(sql)}`;
  if (caller === undefined) return refusedOf("Unknown thread.");
  if (request.trim() === "") return refusedOf("The request is empty.");
  if (replyToMessageId !== null) {
    const [message] = yield* sql<{
      id: string;
    }>`SELECT id FROM messages WHERE id = ${replyToMessageId} AND thread_id = ${callerId}`;
    if (message === undefined) return refusedOf("No such message in this conversation.");
  }
  if (caller.parentId !== null) {
    yield* insertMessage({
      fromThreadId: callerId,
      isConversationOnly: true,
      isQueued: false,
      isResult: false,
      text: request.trim(),
      threadId: caller.questThreadId,
    });
    return changed<OpenedByAgent>({ _tag: "FollowUp" });
  }
  const target = runnerOf(
    { accountId: caller.accountId, effort: "default", harness: caller.harness, model: "default" },
    choice,
  );
  const overBudget = yield* budgetRefusalOf(caller.missionId, {
    accountId: target.accountId,
    harness: target.harness,
  });
  if (overBudget !== null) return refusedOf(`Not opened: ${overBudget}`);
  if ((yield* runningCountOf(caller.missionId)) >= maxRunning)
    return refusedOf(
      `${maxRunning} threads are already running in this mission. Wait for one to finish, or ask the owner.`,
    );
  const opened = yield* insertThread({
    backups: null,
    choice,
    isAside: false,
    isOpenedByAgent: true,
    isOwnCopyAsked,
    parentId: callerId,
    replyToMessageId,
    text: request,
    title: title !== null && title.trim() !== "" ? title : null,
  });
  return changed<OpenedByAgent>({ _tag: "Opened", threadId: opened.threadId }, { threadsToWake: opened.threadsToWake });
});

/** Whether a thread is directly beneath another, the only threads it may interrupt (thread-messaging). */
export const isBeneath = Effect.fnUntraced(function* (parentId: string, childId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`SELECT id FROM threads WHERE id = ${childId} AND parent_id = ${parentId}`;
  return rows.length > 0;
});

/** Whether a result's journal answer says there is nothing to record, in any case and with a final period. */
const isNothingToRecord = (journal: string) => journal.trim().toLowerCase().replace(/\.$/, "") === nothingToRecord;

/**
 * Records the caller's journal entry, unless it has nothing to record, then its result: it goes to the
 * parent as a thread message, which wakes it, and the turn now running ends the caller Done. Returns the
 * parent, or null for a top thread.
 */
export const reportResult = Effect.fnUntraced(function* (
  threadId: string,
  result: string,
  journal: string,
  includeContext = false,
) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{
    harness: HarnessName;
    missionId: string;
    model: string | null;
    parentId: string | null;
    isAside: number;
  }>`SELECT harness, mission_id AS missionId, model, parent_id AS parentId, is_aside AS isAside FROM threads WHERE id = ${threadId}`;
  if (thread === undefined) return yield* notFound("No such thread.");
  // An aside leaves the journal to its parent (thread-tree, Off-topic requests).
  if (thread.isAside === 0 && !isNothingToRecord(journal)) {
    const author: JournalAuthor = { kind: "thread", threadId };
    yield* updateJournal(thread.missionId, author, journal, null);
  }
  yield* sql`UPDATE threads SET reported_turn_id = (
        SELECT id FROM turns WHERE thread_id = ${threadId} AND status = 'running' ORDER BY started_at DESC LIMIT 1)
      WHERE id = ${threadId}`;
  // The top thread's result asks the owner "Mark as done?"; the mission does not end on its own.
  if (thread.parentId === null) {
    yield* sql`UPDATE missions SET is_asking_done = 1 WHERE id = ${thread.missionId} AND ${isQuestStandingOf(sql, ["open"], "missions")}`;
    return changed(null);
  }
  // One-message reporting: post the result as this errand's own reply and echo it to the parent in one step.
  const replyId = yield* insertReply(thread.missionId, threadId, result, {
    harness: thread.harness,
    model: thread.model === "default" ? null : thread.model,
  });
  const parentText = yield* withThreadContext(threadId, result, includeContext, replyId);
  // A run errand reports into its Ritual's conversation — the run history no thread takes a turn at (CHG-0616) —
  // so the report stays in the history without waking the conversation.
  const [beneathRitual] = yield* sql<{ id: string }>`SELECT r.id FROM rituals r
      JOIN missions m ON m.id = r.mission_id WHERE m.top_thread_id = ${thread.parentId}`;
  const { threadsToWake } = yield* insertMessage({
    fromThreadId: threadId,
    isConversationOnly: beneathRitual !== undefined,
    isQueued: false,
    isResult: true,
    text: parentText,
    threadId: thread.parentId,
  });
  return changed(thread.parentId, { threadsToWake });
});
