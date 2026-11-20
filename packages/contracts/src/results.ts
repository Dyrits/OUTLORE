import { Schema } from "effect";
import { FileDiff } from "./activities.ts";
import { AttachmentCard, AttachmentContent } from "./attachments.ts";
import { AccountBudget, BudgetWindow, PriceStatus } from "./budgets.ts";
import { ChronicleItem } from "./chronicle.ts";
import { connectorResults } from "./connectorRequests.ts";
import { DictationStatus, Transcript } from "./dictation.ts";
import { EffortChoice, HarnessList } from "./harnesses.ts";
import { HostUpdate } from "./hostUpdate.ts";
import { MessageId, MissionId, ThreadId } from "./ids.ts";
import { JournalView } from "./journal.ts";
import { LoreHistory, LoreView } from "./lore.ts";
import { Mentionable } from "./mentions.ts";
import { PermissionsView, Question } from "./questions.ts";
import { QuestPlacement, realmResults } from "./realmRequests.ts";
import {
  EndingPreview,
  GuildHallRecap,
  GuildmasterPlace,
  MissionDetail,
  MissionList,
  Settings,
  StartChoices,
  StartingContext,
  Suggestion,
  ThreadPanel,
  ThreadSummary,
} from "./records.ts";
import { KnownHost, PairingCode, RemoteAccessView } from "./remote.ts";
import { DeletionPreview, type RequestTag } from "./requests.ts";
import { CreateRitualResult, Ritual } from "./rituals.ts";
import { Skill } from "./skills.ts";
import { threadAnchorResults } from "./threadAnchors.ts";
import { UsageReport } from "./usage.ts";
import { vaultResults } from "./vaultRequests.ts";
import { WorkspaceEntry } from "./workspaceEntries.ts";
import { Folder, FolderListing } from "./workspaces.ts";

/** A started mission's identifiers. */
export const StartMissionResult = Schema.Struct({ messageId: MessageId, missionId: MissionId, threadId: ThreadId });
export type StartMissionResult = typeof StartMissionResult.Type;
/** A quest started without a message: where it and its top thread are. */
export const StartEmptyQuestResult = Schema.Struct({ missionId: MissionId, threadId: ThreadId });
export type StartEmptyQuestResult = typeof StartEmptyQuestResult.Type;
/** A sent message's identifier. */
export const SendMessageResult = Schema.Struct({ messageId: MessageId });
export type SendMessageResult = typeof SendMessageResult.Type;
/** An opened thread's identifier and its first message's. */
export const OpenThreadResult = Schema.Struct({ messageId: MessageId, threadId: ThreadId });
export type OpenThreadResult = typeof OpenThreadResult.Type;

/** The result schema of each request, used by both sides to encode and decode. */
export const Results = {
  ...realmResults,
  ...connectorResults,
  ...threadAnchorResults,
  ...vaultResults,
  AddAccount: HarnessList,
  AddAttachment: AttachmentCard,
  AddBrowsableRoot: FolderListing,
  AddCredit: Schema.Null,
  AddHost: KnownHost,
  AddJournalEntry: JournalView,
  AnswerChoices: Question,
  AnswerQuestion: Question,
  AnswerSuggestion: Suggestion,
  ArchiveThread: Schema.Null,
  BrowseFolders: FolderListing,
  ChangeSettings: Settings,
  ChangeThreadRunner: Schema.Null,
  CreateFolder: Folder,
  CreatePairingCode: PairingCode,
  CreateRitual: CreateRitualResult,
  DeleteIntel: Schema.Null,
  DeleteRitual: Schema.Null,
  DeleteThread: Schema.Null,
  DiscardAttachment: Schema.Null,
  DisconnectDevice: RemoteAccessView,
  DismissMissionPrompt: Schema.Null,
  EditIntel: Schema.Null,
  EndMission: QuestPlacement,
  InstallHarness: HarnessList,
  InterruptThread: Schema.Null,
  ListHarnesses: HarnessList,
  ListHosts: Schema.Array(KnownHost),
  ListIntel: LoreView,
  ListMentionables: Schema.Array(Mentionable),
  ListMissions: MissionList,
  ListModelEfforts: Schema.Array(EffortChoice),
  ListOpenQuestions: Schema.Array(Question),
  ListRituals: Schema.Array(Ritual),
  ListSkills: Schema.Array(Skill),
  ListWorkspaceEntries: Schema.Array(WorkspaceEntry),
  MarkThreadDone: Schema.Null,
  MarkThreadRead: Schema.Null,
  MoveQuest: Schema.Null,
  OpenThread: OpenThreadResult,
  PinIntel: Schema.Null,
  PreviewDeletion: DeletionPreview,
  PreviewEnding: EndingPreview,
  PreviewStartingContext: StartingContext,
  ReadAccountBudgets: Schema.Array(AccountBudget),
  ReadAttachment: AttachmentContent,
  ReadBudget: BudgetWindow,
  ReadChronicle: Schema.Array(ChronicleItem),
  ReadDictation: DictationStatus,
  ReadFileDiff: FileDiff,
  ReadGuildHallRecap: GuildHallRecap,
  ReadGuildmaster: GuildmasterPlace,
  ReadHostName: Schema.String,
  ReadHostUpdate: HostUpdate,
  ReadIntelHistory: LoreHistory,
  ReadJournal: JournalView,
  ReadMission: MissionDetail,
  ReadPermissions: PermissionsView,
  ReadPriceStatus: PriceStatus,
  ReadRemoteAccess: RemoteAccessView,
  ReadRitual: Schema.NullOr(Ritual),
  ReadSettings: Settings,
  ReadStartChoices: StartChoices,
  ReadThreadPanel: ThreadPanel,
  ReadThreadTree: Schema.Array(ThreadSummary),
  ReadUsage: UsageReport,
  RefreshPrices: PriceStatus,
  RemoveAccount: HarnessList,
  RemoveBrowsableRoot: FolderListing,
  RemoveHost: Schema.Array(KnownHost),
  RemovePermission: Schema.Null,
  RenameAccount: HarnessList,
  RenameHost: Schema.String,
  RenameMission: Schema.Null,
  RenameOwnAccount: HarnessList,
  ReopenMission: Schema.Null,
  ReopenThread: Schema.Null,
  ResolveChatter: Schema.Null,
  ResolveIntelChange: Schema.Null,
  ResolveIntelProposal: Schema.Null,
  RestoreIntel: Schema.Null,
  RestoreThread: Schema.Null,
  ResumeThread: Schema.Null,
  RetryThread: Schema.Null,
  RewriteBriefing: JournalView,
  RunRitual: Schema.Null,
  SearchFolders: Schema.Array(Folder),
  SendMessage: SendMessageResult,
  SetAccountBudget: Schema.Null,
  SetMissionBudget: Schema.Null,
  SetRemoteAccess: RemoteAccessView,
  SetThreadBackups: Schema.Null,
  SignInAccount: Schema.NullOr(HarnessList),
  StartEmptyQuest: StartEmptyQuestResult,
  StartMission: StartMissionResult,
  SteerQueuedMessage: Schema.Null,
  StopAtBudget: Schema.Null,
  StopThread: Schema.Null,
  SwitchAtBudget: Schema.Null,
  TranscribeDictation: Transcript,
  UndoIntelChange: Schema.Null,
  UpdateHarness: HarnessList,
  UpdateHost: HostUpdate,
  UpdateRitual: Schema.Null,
  UpdateSettings: Settings,
  UseOwnRelay: RemoteAccessView,
  UseSharedRelay: RemoteAccessView,
  VisitGuildHall: Schema.Null,
  WidenPermission: Schema.Null,
} as const;
/** What the service answers to one kind of request. */
export type ResultOf<Tag extends RequestTag> = (typeof Results)[Tag]["Type"];
