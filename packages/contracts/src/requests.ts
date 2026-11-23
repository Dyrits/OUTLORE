import { Schema } from "effect";
import {
  AddAccount,
  InstallHarness,
  ListHarnesses,
  ListModelEfforts,
  RemoveAccount,
  RenameAccount,
  RenameOwnAccount,
  SignInAccount,
  UpdateHarness,
} from "./accountRequests.ts";
import { ReadFileDiff } from "./activityRequests.ts";
import {
  AddAttachment,
  DiscardAttachment,
  ReadAttachment,
  ReadDictation,
  TranscribeDictation,
} from "./attachmentRequests.ts";
import { maxAttachmentsPerMessage } from "./attachments.ts";
import {
  AddCredit,
  ReadAccountBudgets,
  ReadPriceStatus,
  RefreshPrices,
  SetAccountBudget,
  SwitchAtBudget,
} from "./budgetRequests.ts";
import { BudgetLimits } from "./budgets.ts";
import { BackupCompanions, ModelChoice } from "./companions.ts";
import { connectorRequests } from "./connectorRequests.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import {
  AccountId,
  AttachmentId,
  BudgetStopId,
  MessageId,
  MissionId,
  PermissionId,
  QuestionId,
  SuggestionId,
  ThreadId,
  WorkspaceId,
} from "./ids.ts";
import { AddJournalEntry, ReadJournal, RewriteBriefing } from "./journalRequests.ts";
import {
  DeleteLoreEntry,
  EditLoreEntry,
  ListLore,
  PinLoreEntry,
  ReadLoreHistory,
  ResolveLoreChange,
  ResolveLoreProposal,
  RestoreLoreEntry,
  UndoLoreChange,
} from "./loreRequests.ts";
import {
  AddBrowsableRoot,
  BrowseFolders,
  CreateFolder,
  ListMentionables,
  ListSkills,
  ListWorkspaceEntries,
  RemoveBrowsableRoot,
  SearchFolders,
} from "./pickerRequests.ts";
import { ChoiceAnswers, ThreadPermissionMode } from "./questions.ts";
import { NewRealmAppearance, realmRequests } from "./realmRequests.ts";
import { MessageDelivery, MissionEnding, MissionPrompt, MissionState, RequestId, Viewing } from "./records.ts";
import {
  AddHost,
  CreatePairingCode,
  DisconnectDevice,
  ListHosts,
  ReadHostName,
  ReadRemoteAccess,
  RemoveHost,
  RenameHost,
  SetRemoteAccess,
  UseOwnRelay,
  UseSharedRelay,
} from "./remote.ts";
import { CreateRitual, DeleteRitual, ListRituals, ReadRitual, RunRitual, UpdateRitual } from "./rituals.ts";
import { ChangeSettings, UpdateSettings } from "./settingsRequests.ts";
import { CloseTerminal, OpenTerminal, ResizeTerminal, WriteTerminalInput } from "./terminalRequests.ts";
import { OwnerMessageText } from "./texts.ts";
import { threadAnchorRequests } from "./threadAnchors.ts";
import { UsageFilter, UsagePeriod } from "./usage.ts";
import { vaultRequests } from "./vaultRequests.ts";

// Requests

/** The files an owner's message carries, added beforehand with `AddAttachment`; absent is none. */
const AttachmentIds = Schema.optionalKey(
  Schema.Array(AttachmentId).check(Schema.isMaxLength(maxAttachmentsPerMessage)),
);

/** Reads the host's release and where updating it stands; a paired device of another release may ask it. */
export const ReadHostUpdate = Schema.TaggedStruct("ReadHostUpdate", {});
/**
 * Tells the host to look for a newer release, download it, and install it once no turn is running; the answer is
 * where that stands. Repeating it changes nothing, and a running turn is never stopped for it.
 */
export const UpdateHost = Schema.TaggedStruct("UpdateHost", {});
/**
 * Tells the host to install the update now, stopping the turns still running (CHG-0661): `UpdateHost` that does not
 * wait. A request of its own, not a flag on `UpdateHost`, so that a host from before it answers with a failure instead
 * of ignoring the flag and waiting. Nothing is forced without it; the answer is where updating stands.
 */
export const ForceUpdateHost = Schema.TaggedStruct("ForceUpdateHost", {});

/** Starts a mission with its first message, model, effort, and workspace. */
export const StartMission = Schema.TaggedStruct("StartMission", {
  /** The provider account, or null for the harness's own sign-in on this computer; absent is null. */
  accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
  attachmentIds: AttachmentIds,
  effort: EffortChoice,
  /** Absent starts on the Settings default harness. */
  harness: Schema.optionalKey(HarnessName),
  model: ModelChoice,
  /**
   * The name the owner gave a folder that is not a realm yet; used when this mission turns it into one, and
   * ignored when the folder already is a realm. Absent names it after its folder.
   */
  realm: Schema.optionalKey(NewRealmAppearance),
  requestId: RequestId,
  text: OwnerMessageText,
  /** An existing folder, chosen in the system's folder dialog, or null for the mission's scratch folder. */
  workspacePath: Schema.NullOr(Schema.String),
});
/**
 * Starts a quest with no message yet, on the choices of the last quest started, in a realm or in the Borderlands.
 * It is named "New quest" until its first message names it.
 */
export const StartEmptyQuest = Schema.TaggedStruct("StartEmptyQuest", {
  /** The realm to place it in, or null for the Borderlands. */
  realmId: Schema.NullOr(WorkspaceId),
  requestId: RequestId,
});
/** Sends the owner's message to a thread, steered or queued. */
export const SendMessage = Schema.TaggedStruct("SendMessage", {
  attachmentIds: AttachmentIds,
  /** Steer or Queue while the thread runs; null uses the owner's default. */
  delivery: Schema.NullOr(MessageDelivery),
  /** The realm's folder the owner attached, for the Chronicler: a quest it opens starts there. */
  realmPath: Schema.optionalKey(Schema.NullOr(Schema.String)),
  requestId: RequestId,
  text: OwnerMessageText,
  threadId: ThreadId,
  /** Where the owner has Chronicler open from, for Chronicler: the screen, and its quest when it is one. */
  viewing: Schema.optionalKey(Schema.NullOr(Viewing)),
});
/** Lets a queued owner message join its thread's running turn instead of waiting for the next one (thread-messaging, Delivery). */
export const SteerQueuedMessage = Schema.TaggedStruct("SteerQueuedMessage", { messageId: MessageId });
export const EditQueuedMessage = Schema.TaggedStruct("EditQueuedMessage", {
  messageId: MessageId,
  text: Schema.String,
});
export const RemoveQueuedMessage = Schema.TaggedStruct("RemoveQueuedMessage", { messageId: MessageId });
/** The dashboard (not archived) or the Archived view, filtered by state and workspace and searched. */
export const ListMissions = Schema.TaggedStruct("ListMissions", {
  /** Whether the realm's Rituals come with the quests, as ritual rows among them; left out they stay apart. */
  includeRituals: Schema.optionalKey(Schema.Boolean),
  isArchived: Schema.Boolean,
  /** Matched against titles and briefings, ignoring case; null or blank matches all. */
  search: Schema.NullOr(Schema.String),
  state: Schema.NullOr(MissionState),
  workspaceId: Schema.NullOr(WorkspaceId),
});
/** Where the Chronicler's conversation is; the service makes it on first use. */
export const ReadChronicle = Schema.TaggedStruct("ReadChronicle", {});
/** Records that the owner is reading a thread's conversation now, so its replies, results and requests are no longer unread. */
export const MarkThreadRead = Schema.TaggedStruct("MarkThreadRead", { threadId: ThreadId });
export const ReadGuildmaster = Schema.TaggedStruct("ReadGuildmaster", {
  channelId: Schema.optional(Schema.NullOr(WorkspaceId)),
});
/** The Guild Hall's recap since `since`, or since the last visit when null (24 hours before the first). */
export const ReadGuildHallRecap = Schema.TaggedStruct("ReadGuildHallRecap", { since: Schema.NullOr(Schema.Number) });
/** Records that the owner is at the Guild Hall now, so the next recap starts here. */
export const VisitGuildHall = Schema.TaggedStruct("VisitGuildHall", {});
/** Asks for the new-mission choices prefilled from the last mission started. */
export const ReadStartChoices = Schema.TaggedStruct("ReadStartChoices", {});
/** The owner renames a mission; `set_mission_title` is refused afterwards. */
export const RenameMission = Schema.TaggedStruct("RenameMission", { missionId: MissionId, title: Schema.String });
/** Asks what ending a mission would stop, before the owner confirms. */
export const PreviewEnding = Schema.TaggedStruct("PreviewEnding", { ending: MissionEnding, missionId: MissionId });
/** Marks Done or archives, stopping the threads the preview named; a changed set asks for a fresh preview. */
export const EndMission = Schema.TaggedStruct("EndMission", {
  ending: MissionEnding,
  missionId: MissionId,
  snapshot: Schema.String,
});
/** Returns a Done or archived mission to the state worked out from its threads. */
export const ReopenMission = Schema.TaggedStruct("ReopenMission", { missionId: MissionId });
/**
 * Moves a quest, with every errand at every depth, to a realm or to the Borderlands (mission-tracking, Quest placement
 * and moves). Refused while any thread of the quest is in a turn; the app asks the owner to confirm before it sends this.
 */
export const MoveQuest = Schema.TaggedStruct("MoveQuest", {
  missionId: MissionId,
  /** The realm to move it to, or null for the Borderlands. */
  realmId: Schema.NullOr(WorkspaceId),
});
/** Not now on a dashboard question; the inactivity question comes back after another inactive period. */
export const DismissMissionPrompt = Schema.TaggedStruct("DismissMissionPrompt", {
  missionId: MissionId,
  prompt: MissionPrompt,
});
/** Reads a mission with the conversation of one of its threads; null reads the top thread. */
export const ReadMission = Schema.TaggedStruct("ReadMission", {
  missionId: MissionId,
  threadId: Schema.NullOr(ThreadId),
});
/** Reads a mission's thread tree alone, without any conversation: what the sidebar and the quest list show. */
export const ReadThreadTree = Schema.TaggedStruct("ReadThreadTree", { missionId: MissionId });
/** Reads what the thread panel shows of a thread: its context gauge and what it spent (thread-panel). */
export const ReadThreadPanel = Schema.TaggedStruct("ReadThreadPanel", { threadId: ThreadId });
/** The owner opens a thread beneath any thread of a mission, with its first message (thread-tree, Opening a thread). */
export const OpenThread = Schema.TaggedStruct("OpenThread", {
  /** Absent keeps the parent's account when the harness is the parent's, else the computer's own sign-in. */
  accountId: Schema.optionalKey(Schema.NullOr(AccountId)),
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
/**
 * The owner's answers to a choice question (CHG-0299): one list per choice, in order, of the options' labels or the
 * owner's own text; exactly one entry unless the choice allows several. null skips the question.
 */
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
/**
 * Reads the usage page: what turns used over a period of local days, narrowed to the rows selected in the breakdowns
 * (budget-control, Reserves usage page). Several filters of different dimensions all apply.
 */
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
export const SetThreadPermissionMode = Schema.TaggedStruct("SetThreadPermissionMode", {
  mode: Schema.NullOr(ThreadPermissionMode),
  threadId: ThreadId,
});
/** Tries again a thread's failed turn, or a thread waiting in Attention on its missing workspace folder (Retry). */
export const RetryThread = Schema.TaggedStruct("RetryThread", { threadId: ThreadId });
/** Reads the standing permissions, for one mission or all. */
export const ReadPermissions = Schema.TaggedStruct("ReadPermissions", { missionId: Schema.NullOr(MissionId) });
/** Widens a standing permission to every mission. */
export const WidenPermission = Schema.TaggedStruct("WidenPermission", { permissionId: PermissionId });
/** Removes a standing permission. */
export const RemovePermission = Schema.TaggedStruct("RemovePermission", { permissionId: PermissionId });
/** Every request the app can make of the service. */
export const Request = Schema.Union([
  AddAttachment,
  DiscardAttachment,
  ReadAttachment,
  ReadDictation,
  ReadFileDiff,
  ReadHostUpdate,
  UpdateHost,
  ForceUpdateHost,
  TranscribeDictation,
  StartMission,
  StartEmptyQuest,
  PreviewDeletion,
  ResolveChatter,
  DeleteThread,
  SendMessage,
  SteerQueuedMessage,
  EditQueuedMessage,
  RemoveQueuedMessage,
  ListMissions,
  ReadStartChoices,
  ReadGuildmaster,
  ReadChronicle,
  MarkThreadRead,
  ReadGuildHallRecap,
  VisitGuildHall,
  RenameMission,
  PreviewEnding,
  EndMission,
  ReopenMission,
  MoveQuest,
  DismissMissionPrompt,
  ReadMission,
  ReadThreadPanel,
  ReadThreadTree,
  ReadSettings,
  ReadPriceStatus,
  RefreshPrices,
  ReadAccountBudgets,
  SetAccountBudget,
  AddCredit,
  SwitchAtBudget,
  UpdateSettings,
  ChangeSettings,
  ReadJournal,
  RewriteBriefing,
  AddJournalEntry,
  ListLore,
  EditLoreEntry,
  DeleteLoreEntry,
  PinLoreEntry,
  RestoreLoreEntry,
  ResolveLoreChange,
  ResolveLoreProposal,
  ReadLoreHistory,
  UndoLoreChange,
  AnswerChoices,
  AnswerQuestion,
  AnswerSuggestion,
  SetMissionBudget,
  ...realmRequests,
  ...connectorRequests,
  ...threadAnchorRequests,
  ...vaultRequests,
  ReadBudget,
  ReadUsage,
  StopAtBudget,
  ListOpenQuestions,
  StopThread,
  RetryThread,
  ChangeThreadRunner,
  CreateRitual,
  UpdateRitual,
  RunRitual,
  SetThreadBackups,
  SetThreadPermissionMode,
  MarkThreadDone,
  ReopenThread,
  ArchiveThread,
  RestoreThread,
  DeleteRitual,
  ListRituals,
  ReadRitual,
  InterruptThread,
  OpenThread,
  PreviewStartingContext,
  ResumeThread,
  ReadPermissions,
  WidenPermission,
  RemovePermission,
  BrowseFolders,
  ListSkills,
  ListWorkspaceEntries,
  ListMentionables,
  CreateFolder,
  OpenTerminal,
  WriteTerminalInput,
  ResizeTerminal,
  CloseTerminal,
  AddBrowsableRoot,
  RemoveBrowsableRoot,
  SearchFolders,
  ListHarnesses,
  ListModelEfforts,
  AddAccount,
  RenameAccount,
  RenameOwnAccount,
  RemoveAccount,
  SignInAccount,
  UpdateHarness,
  InstallHarness,
  ReadRemoteAccess,
  SetRemoteAccess,
  UseOwnRelay,
  UseSharedRelay,
  CreatePairingCode,
  DisconnectDevice,
  RenameHost,
  ReadHostName,
  ListHosts,
  AddHost,
  RemoveHost,
]);
export type Request = typeof Request.Type;
/** The name of one kind of request. */
export type RequestTag = Request["_tag"];

/** The kinds of failure the app tells apart. */
export const ErrorKind = Schema.Literals([
  "InvalidInput",
  "NotFound",
  "StaleVersion",
  "AccessRefused",
  "Unsupported",
  "MissingDependency",
  "ExecutionFailure",
]);
export type ErrorKind = typeof ErrorKind.Type;

/** A failure as the app receives it. */
export const ServiceError = Schema.Struct({ kind: ErrorKind, message: Schema.String });
export type ServiceError = typeof ServiceError.Type;
