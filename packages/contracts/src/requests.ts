import { Schema } from "effect";
import {
  AddAccount,
  AddKeyAccount,
  InstallHarness,
  ListHarnesses,
  ListModelEfforts,
  RemoveAccount,
  RenameAccount,
  RenameOwnAccount,
  ReplaceAccountKey,
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
import {
  AddCredit,
  ReadAccountBudgets,
  ReadPriceStatus,
  RefreshPrices,
  SetAccountBudget,
  SwitchAtBudget,
} from "./budgetRequests.ts";
import { connectorRequests } from "./connectorRequests.ts";
import { controlRequests } from "./controlRequests.ts";
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
import { AnswerPhoneCall, SetPhoneTools } from "./phoneCalls.ts";
import {
  AddBrowsableRoot,
  BrowseFolders,
  CreateFolder,
  ListCompanions,
  ListMentionables,
  ListSkills,
  ListWorkspaceEntries,
  RemoveBrowsableRoot,
  SearchFolders,
} from "./pickerRequests.ts";
import { questRequests } from "./questRequests.ts";
import { realmRequests } from "./realmRequests.ts";
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
import { ChangeCompanionPreset, ChangeSettings, UpdateSettings } from "./settingsRequests.ts";
import { CloseTerminal, OpenTerminal, ResizeTerminal, WriteTerminalInput } from "./terminalRequests.ts";
import { threadAnchorRequests } from "./threadAnchors.ts";
import { threadRequests } from "./threadRequests.ts";
import { vaultRequests } from "./vaultRequests.ts";

/** Every request the app can make of the service. */
export const Request = Schema.Union([
  AddAttachment,
  DiscardAttachment,
  ReadAttachment,
  ReadDictation,
  ReadFileDiff,
  TranscribeDictation,
  ...controlRequests,
  ...questRequests,
  ...threadRequests,
  ReadPriceStatus,
  RefreshPrices,
  ReadAccountBudgets,
  SetAccountBudget,
  AddCredit,
  SwitchAtBudget,
  UpdateSettings,
  ChangeSettings,
  ChangeCompanionPreset,
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
  ...realmRequests,
  ...connectorRequests,
  ...threadAnchorRequests,
  ...vaultRequests,
  CreateRitual,
  UpdateRitual,
  RunRitual,
  DeleteRitual,
  ListRituals,
  ReadRitual,
  BrowseFolders,
  ListSkills,
  ListWorkspaceEntries,
  ListMentionables,
  ListCompanions,
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
  AddKeyAccount,
  ReplaceAccountKey,
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
  SetPhoneTools,
  AnswerPhoneCall,
]);
export type Request = typeof Request.Type;
/** The name of one kind of request. */
export type RequestTag = Request["_tag"];
export { ErrorKind, ServiceError } from "./serviceErrors.ts";
