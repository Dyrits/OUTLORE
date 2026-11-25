import { Schema } from "effect";
import { BackgroundCheckIns } from "./backgroundCheckIns.ts";
import { BudgetLimits, BudgetPeriod } from "./budgets.ts";
import { BackupCompanions, CompanionPresets, ModelChoice, Tier } from "./companions.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { PositiveInt } from "./positiveInt.ts";
import { ThreadPermissionMode } from "./questions.ts";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

/** The owner's settings. */
export const Settings = Schema.Struct({
  /** Days after a Done mission was marked Done before it is archived, when auto-archive is on. */
  autoArchiveDays: PositiveInt,
  /** Daily check-in setup, retained while paused. Null means the owner has never opted in. */
  backgroundCheckIns: Schema.optionalKey(Schema.NullOr(BackgroundCheckIns)),
  /** The backup Companions a new quest's thread starts with, in the order a failed turn falls back through them; at most five. */
  backups: BackupCompanions,
  /** The most tokens a mission's briefing may hold, estimated at about 4 characters per token (mission-journal, Size). */
  briefingLimit: PositiveInt,
  /** Messages between two threads before the owner decides how they continue. */
  chatterThreshold: Schema.Int.check(Schema.isGreaterThanOrEqualTo(2)),
  companionPresets: Schema.optionalKey(CompanionPresets),
  defaultEffort: EffortChoice,
  /** The harness a new mission starts on before any mission was started (provider-accounts). */
  defaultHarness: HarnessName,
  /** Copied onto each new mission; empty at first. */
  defaultMissionBudget: BudgetLimits,
  defaultModel: ModelChoice,
  /**
   * The default permission mode every thread without a mode of its own runs with (action-approval, Permission modes;
   * CHG-0617): what the composer's Default permissions means. Full access also lets commands leave the sandbox unasked.
   */
  defaultPermissionMode: ThreadPermissionMode,
  /** Days a Fulfilled or Archived quest stays offered as a place to continue an off-topic or proposed request (thread-tree). */
  endedQuestMatchDays: PositiveInt,
  /** Covers all missions over its period; empty at first. */
  globalBudget: BudgetLimits,
  globalBudgetPeriod: BudgetPeriod,
  /** Days over which an unused lore entry's strength halves, by kind; a rule never fades (scoped-intel, Kinds). */
  intelHalfLives: Schema.Struct({
    decision: PositiveInt,
    fact: PositiveInt,
    preference: PositiveInt,
    temporary: PositiveInt,
  }),
  /** The share of the chosen model's context window, in percent, past which a thread's lore icon turns red (scoped-intel). */
  intelWarningPercent: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(100)),
  /**
   * Whether a paired device may open and steer a conversation shell, off by default; only the host's own window can
   * change it, and a shell it allows runs inside the host's sandbox (conversation-terminal, ADR 0020).
   */
  shouldAllowRemoteTerminals: Schema.Boolean,
  /** Whether Done missions are archived automatically, off by default (mission-tracking, Ending a mission). */
  shouldAutoArchive: Schema.Boolean,
  /** Whether Outlore reads the public model price table; off leaves the snapshot shipped with it (budget-control, The price table). */
  shouldFetchPrices: Schema.Boolean,
  /** Whether an off-topic request opens a new mission without asking when no mission matches (thread-tree). */
  shouldOpenOffTopicMissions: Schema.Boolean,
  shouldShowAgentThreads: Schema.Boolean,
  /** Whether the rail lists finished (Done) quests among the quests; off by default, the board still shows them. */
  shouldShowFinishedQuests: Schema.Boolean,
  shouldStreamReplies: Schema.Boolean,
  /**
   * Whether threads reach their connectors' tools by running code that calls them instead of calling each one, off by
   * default and experimental (connectors, Code Mode; CHG-0324, CHG-0441). Applies from a thread's next listing.
   */
  shouldUseCodeMode: Schema.Boolean,
  /** The Companions Chronicler picks from by request complexity. */
  tiers: Schema.Struct({ Balanced: Schema.NullOr(Tier), Heavy: Schema.NullOr(Tier), Light: Schema.NullOr(Tier) }),
});
export type Settings = typeof Settings.Type;
