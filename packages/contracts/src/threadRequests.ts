import { Schema } from "effect";
import { BackupCompanions, ModelChoice } from "./companions.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MessageId, ThreadId } from "./ids.ts";
import { AttachmentIds } from "./messageFields.ts";
import { ThreadPermissionMode } from "./questions.ts";
import { MessageDelivery, RequestId, SendToParentScope, Viewing } from "./records.ts";
import { OwnerMessageText } from "./texts.ts";

/** Sends the owner's message to a thread, steered or queued. */
export const SendMessage = Schema.TaggedStruct("SendMessage", {
  attachmentIds: AttachmentIds,
  /** Steer or Queue while the thread runs; null uses the owner's default. */
  delivery: Schema.NullOr(MessageDelivery),
  /** The realm's folder the owner attached, for the Chronicler: a quest it opens starts there. */
  realmPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
  requestId: RequestId,
  /** Also echo this message to the parent conversation, with either this message alone or the full child context. */
  sendToParent: Schema.optionalKey(SendToParentScope),
  text: OwnerMessageText,
  threadId: ThreadId,
  /** Where the owner has Chronicler open from, for Chronicler: the screen, and its quest when it is one. */
  viewing: Schema.optionalKey(Schema.NullOr(Viewing)),
});
/** Lets a queued owner message join its thread's running turn instead of waiting for the next one (thread-messaging, Delivery). */
export const SteerQueuedMessage = Schema.TaggedStruct("SteerQueuedMessage", { messageId: MessageId });
/** Returns a steered owner message to the queue, so it waits for the next turn instead of joining the running one (thread-messaging, Delivery). */
export const UnsteerQueuedMessage = Schema.TaggedStruct("UnsteerQueuedMessage", { messageId: MessageId });
/** Changes the text of an owner message that is still queued. */
export const EditQueuedMessage = Schema.TaggedStruct("EditQueuedMessage", {
  messageId: MessageId,
  text: Schema.String,
});
/** Takes an owner message out of the queue before it is sent. */
export const RemoveQueuedMessage = Schema.TaggedStruct("RemoveQueuedMessage", { messageId: MessageId });
/** Records that the owner is reading a thread's conversation now, so its replies, results and requests are no longer unread. */
export const MarkThreadRead = Schema.TaggedStruct("MarkThreadRead", { threadId: ThreadId });
/** Reads what the thread panel shows of a thread: its context gauge and what it spent (thread-panel). */
export const ReadThreadPanel = Schema.TaggedStruct("ReadThreadPanel", { threadId: ThreadId });
/** The owner opens a thread beneath any thread of a mission, with its first message (thread-tree, Opening a thread). */
export const OpenThread = Schema.TaggedStruct("OpenThread", {
  /** Absent keeps the parent's account when the harness is the parent's, else the computer's own sign-in. */
  accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
  /** The message in the parent conversation this errand hangs from, when opened by Reply. */
  anchorMessageId: Schema.optionalKey(Schema.NullOr(MessageId)),
  attachmentIds: AttachmentIds,
  /** A chosen preset's complete backup list; absent inherits the parent's, empty clears it. */
  backups: Schema.optionalKey(BackupCompanions),
  effort: EffortChoice,
  /** Absent runs on the parent's harness. */
  harness: Schema.optionalKey(HarnessName),
  model: ModelChoice,
  parentThreadId: ThreadId,
  requestId: RequestId,
  /** The owner chose to start it although its starting context is over the warning share. */
  shouldStartAnyway: Schema.Boolean,
  text: OwnerMessageText,
});
/** What a thread the owner opens beneath a thread would start with, before it starts (thread-tree, Opening a thread). */
export const PreviewStartingContext = Schema.TaggedStruct("PreviewStartingContext", {
  /** Absent runs on the parent's harness. */
  harness: Schema.optionalKey(HarnessName),
  model: ModelChoice,
  parentThreadId: ThreadId,
  /** The request typed so far, which may still be empty. */
  text: OwnerMessageText,
});
/** The counts and snapshot covered by one permanent deletion confirmation. */
export const DeletionPreview = Schema.Struct({
  confirmation: Schema.String,
  descendantCount: Schema.Number,
  isMission: Schema.Boolean,
  runningCount: Schema.Number,
});
export type DeletionPreview = typeof DeletionPreview.Type;
/** Reads the subtree before the owner confirms its deletion. */
export const PreviewDeletion = Schema.TaggedStruct("PreviewDeletion", { threadId: ThreadId });
/** Deletes exactly the subtree the owner reviewed, or asks for a fresh preview if it changed. */
export const DeleteThread = Schema.TaggedStruct("DeleteThread", { confirmation: Schema.String, threadId: ThreadId });
/** Ends a running thread's current turn and keeps the thread usable (thread-messaging, Interruptions). */
export const InterruptThread = Schema.TaggedStruct("InterruptThread", { threadId: ThreadId });
/** Stops a thread's work; threads beneath keep running. */
export const StopThread = Schema.TaggedStruct("StopThread", { threadId: ThreadId });
/** Continues a Stopped thread with the messages kept for it (thread-tree, Stopping). */
export const ResumeThread = Schema.TaggedStruct("ResumeThread", { threadId: ThreadId });
/**
 * Hands a thread over to another harness, account, model, or effort between turns (thread-handover). A change of
 * harness or account starts a new session with the thread's whole conversation; the rest carries on.
 */
export const ChangeThreadRunner = Schema.TaggedStruct("ChangeThreadRunner", {
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  /** The backups of a chosen preset, which replace the thread's in the same step (companion-presets); left out, they stay as they are. */
  backups: Schema.optionalKey(BackupCompanions),
  effort: EffortChoice,
  harness: HarnessName,
  model: ModelChoice,
  threadId: ThreadId,
});
/** Marks an errand done on the owner's word, without ending its quest; its turn stops (thread-tree, Done). */
export const MarkThreadDone = Schema.TaggedStruct("MarkThreadDone", { threadId: ThreadId });
/** Reopens a fulfilled errand. */
export const ReopenThread = Schema.TaggedStruct("ReopenThread", { threadId: ThreadId });
/**
 * Archives an errand and the errands beneath it on their own, without archiving its quest: their work stops and they
 * leave the lists, and the conversations stay readable from the quest (thread-tree, Archiving an errand).
 */
export const ArchiveThread = Schema.TaggedStruct("ArchiveThread", { threadId: ThreadId });
/** Brings an archived errand, with the errands archived beneath it, back to the lists; they stay Stopped. */
export const RestoreThread = Schema.TaggedStruct("RestoreThread", { threadId: ThreadId });
/** Saves the thread's backup Companions, in the order a failed turn falls back through them (thread-panel, Backups). */
export const SetThreadBackups = Schema.TaggedStruct("SetThreadBackups", {
  backups: BackupCompanions,
  threadId: ThreadId,
});
/** Sets the permission mode a thread runs under, or null to follow the default. */
export const SetThreadPermissionMode = Schema.TaggedStruct("SetThreadPermissionMode", {
  mode: Schema.NullOr(ThreadPermissionMode),
  threadId: ThreadId,
});
/** Tries again a thread's failed turn, or a thread waiting in Attention on its missing workspace folder (Retry). */
export const RetryThread = Schema.TaggedStruct("RetryThread", { threadId: ThreadId });

/** Every thread-level request schema. */
export const threadRequests = [
  PreviewDeletion,
  DeleteThread,
  SendMessage,
  SteerQueuedMessage,
  UnsteerQueuedMessage,
  EditQueuedMessage,
  RemoveQueuedMessage,
  MarkThreadRead,
  ReadThreadPanel,
  StopThread,
  RetryThread,
  ChangeThreadRunner,
  SetThreadBackups,
  SetThreadPermissionMode,
  MarkThreadDone,
  ReopenThread,
  ArchiveThread,
  RestoreThread,
  InterruptThread,
  OpenThread,
  PreviewStartingContext,
  ResumeThread,
] as const;
