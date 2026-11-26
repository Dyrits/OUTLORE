import { Schema } from "effect";
import { BudgetUse, Consumption, TokenUsage } from "./budgets.ts";
import { ModelChoice } from "./companions.ts";
import { LastExchange } from "./exchanges.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MissionId, ThreadId, WorkspaceId } from "./ids.ts";
import { RitualCard } from "./ritualSchedules.ts";
import { MissionState } from "./suggestions.ts";
import { WorkspaceChoice } from "./workspaces.ts";

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
