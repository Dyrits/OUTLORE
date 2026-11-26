import { Schema } from "effect";
import { ModelChoice } from "./companions.ts";
import { EffortChoice, HarnessName } from "./harnesses.ts";
import { AccountId, MissionId, ThreadId, WorkspaceId } from "./ids.ts";
import { AttachmentIds } from "./messageFields.ts";
import { NewRealmAppearance } from "./realmRequests.ts";
import { MissionEnding, MissionState, RequestId } from "./records.ts";
import { OwnerMessageText } from "./texts.ts";

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
/** Reads a mission with the conversation of one of its threads; null reads the top thread. */
export const ReadMission = Schema.TaggedStruct("ReadMission", {
  missionId: MissionId,
  threadId: Schema.NullOr(ThreadId),
});
/** Reads a mission's thread tree alone, without any conversation: what the sidebar and the quest list show. */
export const ReadThreadTree = Schema.TaggedStruct("ReadThreadTree", { missionId: MissionId });

/** Every quest-level request schema. */
export const questRequests = [
  StartMission,
  StartEmptyQuest,
  ListMissions,
  RenameMission,
  PreviewEnding,
  EndMission,
  ReopenMission,
  MoveQuest,
  ReadMission,
  ReadThreadTree,
] as const;
