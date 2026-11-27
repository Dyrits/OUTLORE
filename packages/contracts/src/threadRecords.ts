import { Schema } from "effect";
import { Activity } from "./activities.ts";
import { AttachmentCard } from "./attachments.ts";
import { BudgetEvent, BudgetStop, ReplyUsage } from "./budgets.ts";
import { ModelChoice } from "./companions.ts";
import { LastExchange } from "./exchanges.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MessageId, MissionId, ThreadId } from "./ids.ts";
import { LoreChange, LoreGauge } from "./lore.ts";
import { Question, ThreadPermissionMode } from "./questions.ts";
import { MissionSummary, SenderKind, ThreadState } from "./records.ts";
import { Suggestion } from "./suggestions.ts";
import { Workspace } from "./workspaces.ts";

/** Whether a Companion frame's answered exchanges have been shared as context with the main Companion (CHG-0787). */
export const CompanionFrameContext = Schema.Literals(["None", "Shared", "Outdated"]);
export type CompanionFrameContext = typeof CompanionFrameContext.Type;

/** One message in a thread's conversation. */
export const Message = Schema.Struct({
  /** The files attached to it, in the order the owner added them (message-attachments). */
  attachments: Schema.Array(AttachmentCard),
  /** On a Companion frame's opening message, whether its answers are shared as context with the main Companion (CHG-0787). */
  companionFrameContext: Schema.optionalKey(CompanionFrameContext),
  /** On a follow-up or Companion answer inside a frame, the id of the frame's opening message (CHG-0787). */
  companionFrameId: Schema.optionalKey(MessageId),
  /**
   * The quest the sending thread belongs to, for a thread message, so a conversation can link to it; null otherwise and
   * for a message from the Chronicler, whose quest has no page of its own.
   */
  fromMissionId: Schema.NullOr(MissionId),
  /** The sending thread, for a thread message; null otherwise. */
  fromThreadId: Schema.NullOr(ThreadId),
  /** The sending thread's title, for a thread message; null otherwise. */
  fromTitle: Schema.NullOr(Schema.String),
  /** The harness that wrote an agent reply, which a handover leaves behind; null for other messages. */
  harness: Schema.NullOr(HarnessName),
  id: MessageId,
  /**
   * Whether it is a mentioned Companion's answer to the owner's message `replyToMessageId` (thread-messaging, Mentioning
   * a Companion with @); a host that omits it, or an older one, sends none as an answer.
   */
  isCompanionAnswer: Schema.optionalKey(Schema.Boolean),
  /** Whether a running turn or a new turn has taken it in; an owner message not yet delivered is drawn faint. */
  isDelivered: Schema.Boolean,
  /** Whether it is an owner message sent as Queue that still waits for the thread's next turn. */
  isQueued: Schema.Boolean,
  /** Whether it is a result reported by a thread beneath (thread-tree, Results). */
  isResult: Schema.Boolean,
  /** The model that wrote an agent reply, as its harness named it (such as `claude-sonnet-5-5`); null when unreported. */
  model: Schema.NullOr(Schema.String),
  /** Message this agent reply answers, when it creates an anchor. */
  replyToMessageId: Schema.optionalKey(Schema.NullOr(MessageId)),
  sender: SenderKind,
  sentAt: Schema.Number,
  sequence: Schema.Number,
  text: Schema.String,
  threadId: ThreadId,
  /** What the model call behind an agent reply used, with its cost; null for other messages and when no usage was reported. */
  usage: Schema.NullOr(ReplyUsage),
});
export type Message = typeof Message.Type;

/** What keeps a thread in Attention besides an open question: its workspace folder is gone (workspace-attachment, Missing folder). */
export const ThreadBlocker = Schema.Literals(["MissingWorkspace", "Chatter", "Budget"]);
export type ThreadBlocker = typeof ThreadBlocker.Type;

/** One thread in a mission's tree, as the side tree lists it. */
export const ThreadSummary = Schema.Struct({
  /** Levels beneath the top thread, which is 0. */
  depth: Schema.Number,
  /** The thread's harness and model, shown beside it in the full quest list. */
  harness: HarnessName,
  id: ThreadId,
  /** Whether the owner archived it (with its quest's other errands left alone): only the conversation's tree lists these. */
  isArchived: Schema.optionalKey(Schema.Boolean),
  /** Whether it holds an off-topic request the owner kept as an aside (thread-tree, Off-topic requests). */
  isAside: Schema.Boolean,
  /** Whether an errand holds nothing of its own (no message, turn, or errand beneath it): archiving it deletes it. */
  isEmpty: Schema.optionalKey(Schema.Boolean),
  /** Whether a thread opened it with `open_thread`, rather than the owner. */
  isOpenedByAgent: Schema.Boolean,
  /** The time of its latest message, or of its opening while it has none. */
  lastActivityAt: Schema.Number,
  /** A sample of its last exchange, for its reply line. */
  lastExchange: LastExchange,
  model: ModelChoice,
  /** When it was opened: the time of its first message. */
  openedAt: Schema.Number,
  parentId: Schema.NullOr(ThreadId),
  /**
   * Replies in this thread, for compact in-feed reply lines: every message of the thread when it hangs from an anchor
   * message of its parent conversation (the root lives there, so the thread's own first message is a reply), else every
   * message after the first, which is its own root.
   */
  replyCount: Schema.optionalKey(Schema.Number),
  /** The status shown for it: its own state rolled up with its active descendants' (mission-tracking, Mission state). */
  shownState: ThreadState,
  state: ThreadState,
  title: Schema.String,
  /** Messages kept for the thread and not yet delivered, such as while it is Stopped. */
  waitingCount: Schema.Number,
});
export type ThreadSummary = typeof ThreadSummary.Type;

/** What the owner can do with a thread now, worked out by the service so every interface offers the same. */
export const ThreadActions = Schema.Struct({
  /** Whether the owner may open a thread beneath it (thread-tree, Limits). */
  canOpenBeneath: Schema.Boolean,
  /** Whether it is Stopped and continues with Resume (thread-tree, Stopping). */
  canResume: Schema.Boolean,
  /** Whether it is at work, so Stop ends its work (thread-tree, Stopping). */
  canStop: Schema.Boolean,
  /** Whether it is at work in a turn: a message can join it, and Interrupt ends it (thread-messaging). */
  isInTurn: Schema.Boolean,
});
export type ThreadActions = typeof ThreadActions.Type;

/** A thread's own git worktree of its workspace and its branch (workspace-attachment, Own copy). */
export const OwnCopyView = Schema.Struct({
  branch: Schema.String,
  /** Whether the own copy's folder no longer exists; absent from older hosts. */
  isMissing: Schema.optionalKey(Schema.Boolean),
  path: Schema.String,
});
export type OwnCopyView = typeof OwnCopyView.Type;

/**
 * The message of the parent conversation a thread hangs from, which its pane shows pinned above the thread's own
 * messages, as Slack's thread panel shows the message replied to (conversation panes, Thread root).
 */
export const ThreadRoot = Schema.Struct({
  /** The files attached to the root message; absent from older hosts that did not send them. */
  attachments: Schema.optionalKey(Schema.Array(AttachmentCard)),
  /** The sending thread's title, for a thread message; null otherwise. */
  fromTitle: Schema.NullOr(Schema.String),
  /** The harness that wrote an agent message; null for other messages. */
  harness: Schema.NullOr(HarnessName),
  id: MessageId,
  /** The model that wrote an agent message, as its harness named it; null when unreported. */
  model: Schema.NullOr(Schema.String),
  sender: SenderKind,
  sentAt: Schema.Number,
  text: Schema.String,
});
export type ThreadRoot = typeof ThreadRoot.Type;

/** The selected thread as its conversation shows it, with the owner's actions on it. */
export const ThreadView = Schema.Struct({
  /** The provider account it runs with, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  /** The account's label as Settings shows it. */
  accountLabel: Schema.String,
  actions: ThreadActions,
  /** Why the thread waits in Attention for Retry, or null. */
  blocker: Schema.NullOr(ThreadBlocker),
  /** Levels beneath the top thread, which is 0. */
  depth: Schema.Number,
  effort: EffortChoice,
  /** Why the last turn failed, while the thread is Failed. */
  failure: Schema.NullOr(Schema.String),
  harness: HarnessName,
  id: ThreadId,
  model: ModelChoice,
  /** The worktree the thread works in, itself or inherited from its parent; null when it works in its workspace's folder. */
  ownCopy: Schema.NullOr(OwnCopyView),
  parentId: Schema.NullOr(ThreadId),
  permissionMode: Schema.optionalKey(Schema.NullOr(ThreadPermissionMode)),
  /** The message of the parent conversation the thread hangs from; absent or null for a thread with no anchor. */
  root: Schema.optionalKey(Schema.NullOr(ThreadRoot)),
  state: ThreadState,
  title: Schema.String,
  /** The harness of the turn the thread is in, as admitted: the owner's later pick does not change it. Null outside a turn. */
  turnHarness: Schema.NullOr(HarnessName),
  /** The model of the turn the thread is in, as admitted. Null outside a turn, or for a turn recorded before models were. */
  turnModel: Schema.NullOr(ModelChoice),
  waitingCount: Schema.Number,
  /**
   * The git worktree of its workspace the thread's own tool calls last moved its shell into (a `cd`, a `git worktree
   * add`), inferred by the service and still there. Absent when it has moved to none, or from a host that does not infer it.
   */
  workingFolder: Schema.optionalKey(Schema.String),
  /** Null when the thread runs in its mission's scratch folder. */
  workspace: Schema.NullOr(Workspace),
});
export type ThreadView = typeof ThreadView.Type;

/** One paused exchange, identified independently of later pauses of the same pair. */
export const ChatterNotice = Schema.Struct({
  count: Schema.Number,
  firstId: ThreadId,
  firstTitle: Schema.String,
  id: Schema.String,
  secondId: ThreadId,
  secondTitle: Schema.String,
});
export type ChatterNotice = typeof ChatterNotice.Type;

export { ThreadPanel } from "./threadPanel.ts";

/**
 * A line in a thread's conversation recording a handover: its harness, account, model, or effort changed; or that its
 * harness could not continue its earlier session (CHG-0208).
 */
export const Handover = Schema.Struct({ at: Schema.Number, id: Schema.String, text: Schema.String });
export type Handover = typeof Handover.Type;

/** A mission with its thread tree and one selected thread's conversation. */
export const MissionDetail = Schema.Struct({
  /** The selected thread's tool calls its harness reported, oldest first, without those that were asked about as actions. */
  activities: Schema.Array(Activity),
  /** Budget lines, shown in the top thread only. */
  budgetEvents: Schema.Array(BudgetEvent),
  /** The mission's open budget stop when the selected thread holds its question. */
  budgetStop: Schema.NullOr(BudgetStop),
  chatter: Schema.Array(ChatterNotice),
  /** The selected thread's handovers, oldest first. */
  handovers: Schema.Array(Handover),
  /** The selected thread's changes to lore, done and awaiting approval, in the order made. */
  loreChanges: Schema.Array(LoreChange),
  /** How much of its model's context window the lore in the selected thread's scope takes. */
  loreGauge: LoreGauge,
  /** The selected thread's messages. */
  messages: Schema.Array(Message),
  mission: MissionSummary,
  /** The selected thread's questions, open and recorded, in the order asked. */
  questions: Schema.Array(Question),
  /** The selected thread's off-topic suggestions, open and resolved, in the order made. */
  suggestions: Schema.Array(Suggestion),
  /** The selected thread: the one asked for, or the top thread. */
  thread: ThreadView,
  /** Every thread of the mission, each parent before the threads beneath it. */
  threads: Schema.Array(ThreadSummary),
});
export type MissionDetail = typeof MissionDetail.Type;
