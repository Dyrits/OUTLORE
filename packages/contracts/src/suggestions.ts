import { Schema } from "effect";
import { BackupCompanions, ModelChoice } from "./companions.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MissionId, SuggestionId, ThreadId } from "./ids.ts";

/**
 * A mission's status: how it ended, Fresh while it holds nothing, otherwise the roll-up of its top thread over its
 * tree (mission-tracking, Mission state; CHG-0599).
 */
export const MissionState = Schema.Literals([
  "Fresh",
  "Underway",
  "Waiting",
  "Attention",
  "Failed",
  "Resting",
  "Stopped",
  "Fulfilled",
  "Archived",
]);
export type MissionState = typeof MissionState.Type;

/** Where an off-topic request went: continued in another mission, a new mission, an aside, or nowhere (withdrawn). */
export const SuggestionOutcome = Schema.Literals(["Continued", "MovedToMission", "KeptAsAside", "Withdrawn"]);
export type SuggestionOutcome = typeof SuggestionOutcome.Type;

/** A mission offered for an off-topic request, with its state when read. */
export const SuggestionMatch = Schema.Struct({ missionId: MissionId, state: MissionState, title: Schema.String });
export type SuggestionMatch = typeof SuggestionMatch.Type;

/** A thread's suggestion for an off-topic request, open or resolved (thread-tree, Off-topic requests). */
export const Suggestion = Schema.Struct({
  /** The suggesting thread's account, prefilled for Open as new mission. */
  accountId: Schema.NullOr(AccountId),
  askedAt: Schema.Number,
  /** The proposed preset's backups, or the default quest backups when no preset is proposed. */
  backups: BackupCompanions,
  /** The suggesting thread's effort, prefilled for Open as new mission. */
  effort: EffortChoice,
  /** The suggesting thread's harness, prefilled for Open as new mission. */
  harness: HarnessName,
  id: SuggestionId,
  /** Whether the setting opened a new mission without asking. */
  isAutomatic: Schema.Boolean,
  /** Whether the Chronicler asked: it offers no aside, and opens the quest in the realm the owner named. */
  isFromGuildmaster: Schema.Boolean,
  /** Whether the card is a Ritual the Chronicler created, whose link opens the Ritual's quest. */
  isRitual: Schema.Boolean,
  /** Matching missions, best first, at most 3. */
  matches: Schema.Array(SuggestionMatch),
  /** The suggesting thread's model, prefilled for Open as new mission. */
  model: ModelChoice,
  outcome: Schema.NullOr(SuggestionOutcome),
  /** The folder of the realm Chronicler proposed for a new quest, or null for none (the owner may change it on the card). */
  realmPath: Schema.NullOr(Schema.String),
  resolvedAt: Schema.NullOr(Schema.Number),
  targetMissionId: Schema.NullOr(MissionId),
  targetThreadId: Schema.NullOr(ThreadId),
  /** The mission or aside it went to, as titled then. */
  targetTitle: Schema.NullOr(Schema.String),
  /** The off-topic part of the owner's message. */
  text: Schema.String,
  threadId: ThreadId,
  /** The thread's proposed title for a new mission or aside. */
  title: Schema.String,
});
export type Suggestion = typeof Suggestion.Type;
