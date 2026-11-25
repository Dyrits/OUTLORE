import { Schema } from "effect";
import { Activity } from "./activities.ts";
import { AttachmentCard } from "./attachments.ts";
import { BudgetEvent, BudgetStop, BudgetUse, Consumption, ReplyUsage, TokenUsage } from "./budgets.ts";
import { ModelChoice } from "./companions.ts";
import { LastExchange } from "./exchanges.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MessageId, MissionId, ThreadId, WorkspaceId } from "./ids.ts";
import { LoreChange, LoreGauge } from "./lore.ts";
import { Question, ThreadPermissionMode } from "./questions.ts";
import { RitualCard } from "./ritualSchedules.ts";
import { MissionState, Suggestion } from "./suggestions.ts";
import { Workspace, WorkspaceChoice } from "./workspaces.ts";

export { GuildHallRecap, GuildmasterPlace, Viewing } from "./guildHall.ts";
export { Settings } from "./settings.ts";
export { StartingContext, StartingContextParts } from "./startingContext.ts";
export { MissionState, Suggestion, SuggestionMatch, SuggestionOutcome } from "./suggestions.ts";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

// Missions, threads, settings, and off-topic suggestions.

/** A client-chosen identifier; repeating a command with it returns the original outcome. */
export const RequestId = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(128));

/** A thread's state; the displayed name is the stored value (thread-tree, Thread states; CHG-0599). */
export const ThreadState = Schema.Literals([
  "Underway",
  "Waiting",
  "Attention",
  "Resting",
  "Fulfilled",
  "Failed",
  "Stopped",
]);
export type ThreadState = typeof ThreadState.Type;

/** Who wrote a message: the owner, the thread's own agent, another thread of the mission, or Outlore (an errand's card). */
export const SenderKind = Schema.Literals(["user", "agent", "thread", "system"]);
export type SenderKind = typeof SenderKind.Type;

/** The model a new quest starts on until the owner picks another (Claude Code's Sonnet 5.5). */
export const startingModel: ModelChoice = "claude-sonnet-5-5";

/** How an owner message reaches a running thread: joining its current turn, or waiting for its next (thread-messaging, Delivery; CHG-0039). */
export const MessageDelivery = Schema.Literals(["Steer", "Queue"]);
export type MessageDelivery = typeof MessageDelivery.Type;

/** How much of a child thread's conversation to include when also sending a message to its parent. */
export const SendToParentScope = Schema.Literals(["MessageOnly", "FullContext"]);
export type SendToParentScope = typeof SendToParentScope.Type;

/** How a mission ended: Fulfilled (marked done), or archived (mission-tracking, Ending a mission). */
export const MissionEnding = Schema.Literals(["Fulfilled", "Archived"]);
export type MissionEnding = typeof MissionEnding.Type;

/** What the dashboard asks of a mission: "Mark as done?" after its result. */
export const MissionPrompt = Schema.Literals(["MarkDone"]);
export type MissionPrompt = typeof MissionPrompt.Type;

/** One mission as the dashboard lists it. */
export const MissionSummary = Schema.Struct({
  /** The mission's budget and its spending over the mission's life. */
  budget: BudgetUse,
  /** What the mission's turns used, with the estimated cost (budget-control, Estimated cost). */
  consumption: Consumption,
  /** The top thread's harness and model, for the card. */
  harness: HarnessName,
  id: MissionId,
  /** Whether it carries nothing worth keeping (no message, no tokens, not a Ritual's): archiving it deletes it. */
  isEmpty: Schema.Boolean,
  /** Whether the owner renamed it, after which `set_mission_title` is refused. */
  isTitleByUser: Schema.Boolean,
  lastActivityAt: Schema.Number,
  /** A sample of the top thread's last exchange, for the realm's reply line. */
  lastExchange: LastExchange,
  model: ModelChoice,
  /** The question the dashboard asks of it, or null. */
  prompt: Schema.NullOr(MissionPrompt),
  /**
   * Replies in the quest's top thread, for compact in-feed reply lines: every message of the thread when it hangs from
   * an anchor message of its channel (the root lives there), else every message after the first, which is its own root.
   */
  replyCount: Schema.optionalKey(Schema.Number),
  /** The Ritual this quest belongs to, or null for an ordinary quest. */
  ritual: Schema.NullOr(RitualCard),
  /** Threads Underway now. */
  runningCount: Schema.Number,
  state: MissionState,
  threadCount: Schema.Number,
  title: Schema.String,
  topThreadId: ThreadId,
  usage: TokenUsage,
  /** The top thread's workspace; both null when it runs in the mission's scratch folder. */
  workspaceId: Schema.NullOr(WorkspaceId),
  workspaceName: Schema.NullOr(Schema.String),
});
export type MissionSummary = typeof MissionSummary.Type;

/** The dashboard's or the Archived view's missions, and the workspaces among that view's missions. */
export const MissionList = Schema.Struct({
  missions: Schema.Array(MissionSummary),
  workspaces: Schema.Array(WorkspaceChoice),
});
export type MissionList = typeof MissionList.Type;

/** What ending a mission would stop, for the one confirmation (mission-tracking, Ending a mission). */
export const EndingPreview = Schema.Struct({
  /** The question naming the threads still at work, or null when none are. */
  question: Schema.NullOr(Schema.String),
  /** Identifies the threads at work when previewed; ending refuses a changed set. */
  snapshot: Schema.String,
  workingCount: Schema.Number,
});
export type EndingPreview = typeof EndingPreview.Type;

/** A new mission's choices: the default Companion and the last mission's folder (mission-tracking, Starting a mission). */
export const StartChoices = Schema.Struct({
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  effort: EffortChoice,
  harness: HarnessName,
  model: ModelChoice,
  workspacePath: Schema.NullOr(Schema.String),
});
export type StartChoices = typeof StartChoices.Type;

/** One message in a thread's conversation. */
export const Message = Schema.Struct({
  /** The files attached to it, in the order the owner added them (message-attachments). */
  attachments: Schema.Array(AttachmentCard),
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
export const OwnCopyView = Schema.Struct({ branch: Schema.String, path: Schema.String });
export type OwnCopyView = typeof OwnCopyView.Type;

/**
 * The message of the parent conversation a thread hangs from, which its pane shows pinned above the thread's own
 * messages, as Slack's thread panel shows the message replied to (conversation panes, Thread root).
 */
export const ThreadRoot = Schema.Struct({
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
