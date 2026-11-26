import { Schema } from "effect";
import { BudgetLimits } from "./budgets.ts";
import { BackupCompanions, ModelChoice } from "./companions.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, BudgetStopId, MissionId, PermissionId, QuestionId, SuggestionId, WorkspaceId } from "./ids.ts";
import { ChoiceAnswers } from "./questions.ts";
import { UsageFilter, UsagePeriod } from "./usage.ts";

/** Reads the host's release and where updating it stands; a paired device of another release may ask it. */
export const ReadHostUpdate = Schema.TaggedStruct("ReadHostUpdate", {});
/** Tells the host to look for a newer release, download it, and install it once no turn is running; the answer is where that stands. Repeating it changes nothing, and a running turn is never stopped for it. */
export const UpdateHost = Schema.TaggedStruct("UpdateHost", {});
/** Tells the host to install the update now, stopping the turns still running (CHG-0664): `UpdateHost` that does not wait. A request of its own, not a flag on `UpdateHost`, so that a host from before it answers with a failure instead of ignoring the flag and waiting. Nothing is forced without it; the answer is where updating stands. */
export const ForceUpdateHost = Schema.TaggedStruct("ForceUpdateHost", {});
/** Where the Chronicler's conversation is; the service makes it on first use. */
export const ReadChronicle = Schema.TaggedStruct("ReadChronicle", {});
/** Reads the Chronicler's conversation for a realm channel, or the Borderlands when absent or null. */
export const ReadGuildmaster = Schema.TaggedStruct("ReadGuildmaster", {
  channelId: Schema.optional(Schema.NullOr(WorkspaceId)),
});
/** The Guild Hall's recap since `since`, or since the last visit when null (24 hours before the first). */
export const ReadGuildHallRecap = Schema.TaggedStruct("ReadGuildHallRecap", { since: Schema.NullOr(Schema.Number) });
/** Records that the owner is at the Guild Hall now, so the next recap starts here. */
export const VisitGuildHall = Schema.TaggedStruct("VisitGuildHall", {});
/** Asks for the new-mission choices prefilled from the last mission started. */
export const ReadStartChoices = Schema.TaggedStruct("ReadStartChoices", {});
/** The owner resolves exactly one chatter pause. */
export const ResolveChatter = Schema.TaggedStruct("ResolveChatter", {
  choice: Schema.Literals(["Continue", "Stop"]),
  id: Schema.String,
});
/** Reads the owner's settings. */
export const ReadSettings = Schema.TaggedStruct("ReadSettings", {});
/** The owner's answer to one open question. */
export const Answer = Schema.Literals(["Allow", "AlwaysAllow", "Deny"]);
export type Answer = typeof Answer.Type;
/** The owner's answer to an approval question. */
export const AnswerQuestion = Schema.TaggedStruct("AnswerQuestion", {
  answer: Answer,
  /** On Deny, an optional message: why, or what to do instead. */
  message: Schema.NullOr(Schema.String),
  questionId: QuestionId,
});
/** The owner's answers to a choice question (CHG-0299): one list per choice, in order, of the options' labels or the owner's own text; exactly one entry unless the choice allows several. null skips the question. */
export const AnswerChoices = Schema.TaggedStruct("AnswerChoices", {
  answers: Schema.NullOr(ChoiceAnswers),
  questionId: QuestionId,
});
/** Lists the open approval questions of every mission. */
export const ListOpenQuestions = Schema.TaggedStruct("ListOpenQuestions", {});
/** The owner sets, changes, or removes a mission's budget; raising past the spending resumes stopped threads. */
export const SetMissionBudget = Schema.TaggedStruct("SetMissionBudget", { limits: BudgetLimits, missionId: MissionId });
/** Reads a mission's budget window, or the global one with null. */
export const ReadBudget = Schema.TaggedStruct("ReadBudget", { missionId: Schema.NullOr(MissionId) });
/** Reads the usage page: what turns used over a period of local days, narrowed to the rows selected in the breakdowns (budget-control, Reserves usage page). Several filters of different dimensions all apply. */
export const ReadUsage = Schema.TaggedStruct("ReadUsage", {
  filters: Schema.Array(UsageFilter),
  period: UsagePeriod,
});
/** The owner answers Stop (or Stop all) to a reached budget: its threads stay stopped. */
export const StopAtBudget = Schema.TaggedStruct("StopAtBudget", { stopId: BudgetStopId });
/** The owner's choice for an off-topic request (thread-tree, Off-topic requests). */
export const SuggestionAnswer = Schema.Union([
  Schema.TaggedStruct("Continue", { missionId: MissionId }),
  Schema.TaggedStruct("NewMission", {
    /** Absent keeps the suggesting thread's account and harness, as for the next two. */
    accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
    /** The backup Companions of the preset chosen on the card; absent keeps the Workshop's default list. */
    backups: Schema.optionalKey(BackupCompanions),
    effort: EffortChoice,
    harness: Schema.optionalKey(HarnessName),
    model: ModelChoice,
    /** The realm identity chosen on the card, including realms without a folder. */
    realmId: Schema.optionalKey(Schema.NullOr(WorkspaceId)),
    /** The folder of the realm to open it in, or null for the Borderlands; absent keeps the realm proposed. */
    realmPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
  }),
  Schema.TaggedStruct("Aside", {}),
]);
export type SuggestionAnswer = typeof SuggestionAnswer.Type;
/** The owner's choice for an off-topic suggestion. */
export const AnswerSuggestion = Schema.TaggedStruct("AnswerSuggestion", {
  answer: SuggestionAnswer,
  suggestionId: SuggestionId,
});
/** Reads the standing permissions, for one mission or all. */
export const ReadPermissions = Schema.TaggedStruct("ReadPermissions", { missionId: Schema.NullOr(MissionId) });
/** Widens a standing permission to every mission. */
export const WidenPermission = Schema.TaggedStruct("WidenPermission", { permissionId: PermissionId });
/** Removes a standing permission. */
export const RemovePermission = Schema.TaggedStruct("RemovePermission", { permissionId: PermissionId });

/** Every control, chronicle, question, budget, and permission request schema. */
export const controlRequests = [
  ReadHostUpdate,
  UpdateHost,
  ForceUpdateHost,
  ResolveChatter,
  ReadStartChoices,
  ReadGuildmaster,
  ReadChronicle,
  ReadGuildHallRecap,
  VisitGuildHall,
  ReadSettings,
  AnswerChoices,
  AnswerQuestion,
  AnswerSuggestion,
  SetMissionBudget,
  ReadBudget,
  ReadUsage,
  StopAtBudget,
  ListOpenQuestions,
  ReadPermissions,
  WidenPermission,
  RemovePermission,
] as const;
