import { Match } from "effect";
import type { Request, RequestTag } from "./requests.ts";

/** The authenticated transport identity accompanying an owner request. */
export type RequestSource = {
  readonly deviceId?: string | null;
  readonly isPairedDevice: boolean;
};

const shared = Object.assign(() => null, { isHostOnly: false });
const hostOnly = Object.assign(() => null, { isHostOnly: true });

type SourceRules = {
  readonly [Tag in RequestTag]: ((request: Extract<Request, { _tag: Tag }>) => string | null) & {
    readonly isHostOnly: boolean;
  };
};

/** Each request explicitly declares its source restriction and the folder it names. */
export const requestSourceRules = {
  AddAccount: shared,
  AddAttachment: shared,
  AddBrowsableRoot: Object.assign((given: Extract<Request, { _tag: "AddBrowsableRoot" }>) => given.path, {
    isHostOnly: true,
  }),
  AddCredit: shared,
  AddHost: hostOnly,
  AddJournalEntry: shared,
  AnswerChoices: shared,
  AnswerQuestion: shared,
  AnswerSuggestion: Object.assign(
    (given: Extract<Request, { _tag: "AnswerSuggestion" }>) =>
      Match.valueTags(given.answer, {
        Aside: () => null,
        Continue: () => null,
        NewMission: (answer) => answer.realmPath ?? null,
      }),
    { isHostOnly: false },
  ),
  ArchiveRealm: shared,
  BrowseFolders: Object.assign((given: Extract<Request, { _tag: "BrowseFolders" }>) => given.path, {
    isHostOnly: false,
  }),
  ChangeSettings: shared,
  ChangeThreadRunner: shared,
  CreateFolder: Object.assign((given: Extract<Request, { _tag: "CreateFolder" }>) => given.parent, {
    isHostOnly: false,
  }),
  CreatePairingCode: hostOnly,
  CreateRealm: Object.assign((given: Extract<Request, { _tag: "CreateRealm" }>) => given.path, { isHostOnly: false }),
  CreateRitual: Object.assign((given: Extract<Request, { _tag: "CreateRitual" }>) => given.workspacePath, {
    isHostOnly: false,
  }),
  DeleteIntel: shared,
  DeleteRitual: shared,
  DeleteThread: shared,
  DiscardAttachment: shared,
  DisconnectDevice: hostOnly,
  DismissMissionPrompt: shared,
  EditIntel: shared,
  EndMission: shared,
  FindArchivedRealm: Object.assign((given: Extract<Request, { _tag: "FindArchivedRealm" }>) => given.path, {
    isHostOnly: false,
  }),
  InstallHarness: shared,
  InterruptThread: shared,
  ListArchivedRealms: shared,
  ListHarnesses: shared,
  ListHosts: hostOnly,
  ListIntel: shared,
  ListMentionables: shared,
  ListMissions: shared,
  ListModelEfforts: shared,
  ListOpenQuestions: shared,
  ListRituals: shared,
  ListSkills: Object.assign((given: Extract<Request, { _tag: "ListSkills" }>) => given.workspacePath, {
    isHostOnly: false,
  }),
  ListWorkspaceEntries: Object.assign(
    (given: Extract<Request, { _tag: "ListWorkspaceEntries" }>) => given.workspacePath,
    { isHostOnly: false },
  ),
  MarkThreadDone: shared,
  MoveQuest: shared,
  OpenThread: shared,
  PinIntel: shared,
  PreviewDeletion: shared,
  PreviewEnding: shared,
  PreviewRealmArchive: shared,
  PreviewStartingContext: shared,
  ReadAccountBudgets: shared,
  ReadAttachment: shared,
  ReadBudget: shared,
  ReadGuildHallRecap: shared,
  ReadGuildmaster: shared,
  ReadHostName: shared,
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
  RefreshPrices: shared,
  RemoveAccount: shared,
  RemoveBrowsableRoot: Object.assign((given: Extract<Request, { _tag: "RemoveBrowsableRoot" }>) => given.path, {
    isHostOnly: true,
  }),
  RemoveHost: hostOnly,
  RemovePermission: shared,
  RenameAccount: shared,
  RenameHost: shared,
  RenameMission: shared,
  RenameOwnAccount: shared,
  RenameRealm: shared,
  ReopenMission: shared,
  ResolveChatter: shared,
  ResolveIntelChange: shared,
  ResolveIntelProposal: shared,
  RestoreIntel: shared,
  RestoreRealm: shared,
  ResumeThread: shared,
  RetryThread: shared,
  RewriteBriefing: shared,
  RunRitual: shared,
  SearchFolders: shared,
  SendMessage: shared,
  SetAccountBudget: shared,
  SetMissionBudget: shared,
  SetRealmCrest: shared,
  SetRemoteAccess: hostOnly,
  SetThreadBackups: shared,
  SignInAccount: shared,
  StartEmptyQuest: shared,
  StartMission: Object.assign((given: Extract<Request, { _tag: "StartMission" }>) => given.workspacePath, {
    isHostOnly: false,
  }),
  StopAtBudget: shared,
  StopThread: shared,
  SwitchAtBudget: shared,
  UndoIntelChange: shared,
  UpdateHarness: shared,
  UpdateRitual: shared,
  UpdateSettings: shared,
  UseOwnRelay: hostOnly,
  UseSharedRelay: hostOnly,
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
