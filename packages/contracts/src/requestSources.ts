import { Match } from "effect";
import type { Request, RequestTag } from "./requests.ts";

/** The authenticated transport identity accompanying an owner request. */
export type RequestSource = {
  readonly deviceId?: string | null;
  readonly isPairedDevice: boolean;
};

const shared = Object.assign(() => null, { isHostOnly: false });
const hostOnly = Object.assign(() => null, { isHostOnly: true });

/** One request rule: its source restriction and the folder it names, in a single line. */
const rule = <Tag extends RequestTag>(
  isHostOnly: boolean,
  folder: (request: Extract<Request, { _tag: Tag }>) => string | null,
) => Object.assign(folder, { isHostOnly });

type SourceRules = {
  readonly [Tag in RequestTag]: ((request: Extract<Request, { _tag: Tag }>) => string | null) & {
    readonly isHostOnly: boolean;
  };
};

/** Each request explicitly declares its source restriction and the folder it names. */
export const requestSourceRules = {
  AddAccount: shared,
  AddAttachment: shared,
  AddBrowsableRoot: rule(true, (given) => given.path),
  AddCredit: shared,
  AddHost: hostOnly,
  AddJournalEntry: shared,
  AnswerChoices: shared,
  AnswerQuestion: shared,
  AnswerSuggestion: rule(false, (given) =>
    Match.valueTags(given.answer, {
      Aside: () => null,
      Continue: () => null,
      NewMission: (answer) => answer.realmPath ?? null,
    }),
  ),
  ArchiveRealm: shared,
  ArchiveThread: shared,
  BrowseFolders: rule(false, (given) => given.path),
  ChangeSettings: shared,
  ChangeThreadRunner: shared,
  ChooseAppleApps: shared,
  CreateFolder: rule(false, (given) => given.parent),
  CreatePairingCode: hostOnly,
  CreateRealm: rule(false, (given) => given.path),
  CreateRitual: rule(false, (given) => given.workspacePath),
  DeleteIntel: shared,
  DeleteRitual: shared,
  DeleteThread: shared,
  DiscardAttachment: shared,
  DisconnectDevice: hostOnly,
  DismissMissionPrompt: shared,
  EditIntel: shared,
  EndMission: shared,
  FindArchivedRealm: rule(false, (given) => given.path),
  InstallConnector: shared,
  InstallHarness: shared,
  InterruptThread: shared,
  ListArchivedRealms: shared,
  ListConnectors: shared,
  ListHarnesses: shared,
  ListHosts: hostOnly,
  ListIntel: shared,
  ListMentionables: shared,
  ListMissions: shared,
  ListModelEfforts: shared,
  ListOpenQuestions: shared,
  ListRituals: shared,
  ListSkills: rule(false, (given) => given.workspacePath),
  ListWorkspaceEntries: rule(false, (given) => given.workspacePath),
  MarkThreadDone: shared,
  MoveQuest: shared,
  OpenThread: shared,
  PinIntel: shared,
  PreviewDeletion: shared,
  PreviewEnding: shared,
  PreviewRealmArchive: shared,
  PreviewStartingContext: shared,
  PutSecret: shared,
  ReadAccountBudgets: shared,
  ReadAttachment: shared,
  ReadBudget: shared,
  ReadConnectorChoices: shared,
  ReadDictation: shared,
  ReadFileDiff: shared,
  ReadGuildHallRecap: shared,
  ReadGuildmaster: shared,
  ReadHostName: shared,
  ReadHostUpdate: shared,
  ReadIntelHistory: shared,
  ReadJournal: shared,
  ReadMission: shared,
  ReadPermissions: shared,
  ReadPriceStatus: shared,
  ReadRemoteAccess: hostOnly,
  ReadRitual: shared,
  ReadSettings: shared,
  ReadStartChoices: shared,
  ReadThreadPanel: shared,
  ReadThreadTree: shared,
  ReadUsage: shared,
  ReadVault: shared,
  RefreshPrices: shared,
  RemoveAccount: shared,
  RemoveBrowsableRoot: rule(true, (given) => given.path),
  RemoveConnector: shared,
  RemoveHost: hostOnly,
  RemovePermission: shared,
  RemoveSecret: shared,
  RenameAccount: shared,
  RenameHost: shared,
  RenameMission: shared,
  RenameOwnAccount: shared,
  RenameRealm: shared,
  ReopenMission: shared,
  ReorderRealms: shared,
  ReplaceSecret: shared,
  RequestApplePermission: hostOnly,
  ResolveChatter: shared,
  ResolveIntelChange: shared,
  ResolveIntelProposal: shared,
  RestoreIntel: shared,
  RestoreRealm: shared,
  RestoreThread: shared,
  ResumeThread: shared,
  RetryThread: shared,
  RewriteBriefing: shared,
  RunRitual: shared,
  SearchFolders: shared,
  SendMessage: shared,
  SetAccountBudget: shared,
  SetConnectorSwitch: shared,
  SetConnectorTool: shared,
  SetMissionBudget: shared,
  SetRemoteAccess: hostOnly,
  SetThreadBackups: shared,
  SignInAccount: shared,
  StartEmptyQuest: shared,
  StartMission: rule(false, (given) => given.workspacePath),
  SteerQueuedMessage: shared,
  StopAtBudget: shared,
  StopThread: shared,
  SwitchAtBudget: shared,
  TranscribeDictation: shared,
  UndoIntelChange: shared,
  UpdateHarness: shared,
  UpdateHost: shared,
  UpdateRitual: shared,
  UpdateSettings: shared,
  UseOwnRelay: hostOnly,
  UseSharedRelay: hostOnly,
  VerifyClaudeVaultDenial: shared,
  VisitGuildHall: shared,
  WidenPermission: shared,
} satisfies SourceRules;

/** Request tags refused before a paired device reaches a handler, derived from the request rules. */
export const hostOnlyRequestTags = Object.entries(requestSourceRules)
  .filter(([, rule]) => rule.isHostOnly)
  .map(([tag]) => tag);

/** The source restriction and named folder for one decoded request. */
export const sourceRulesOf = (request: Request) => ({
  folder: Match.valueTags(request, requestSourceRules),
  isHostOnly: requestSourceRules[request._tag].isHostOnly,
});
