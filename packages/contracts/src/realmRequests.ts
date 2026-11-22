import { Schema } from "effect";
import { MissionId, RitualId, WorkspaceId } from "./ids.ts";
import { NameText } from "./texts.ts";
import { WorkspaceChoice } from "./workspaces.ts";

/** The name chosen for a recovered realm. */
export const RealmAppearance = Schema.Struct({ name: Schema.String });
export type RealmAppearance = typeof RealmAppearance.Type;

/**
 * The name a folder takes when it becomes a realm: required, one to eighty characters.
 * RealmAppearance itself keeps an unconstrained name, for realms as they are stored and shown.
 */
export const NewRealmAppearance = Schema.Struct({ name: NameText });
export type NewRealmAppearance = typeof NewRealmAppearance.Type;

/** A quest's authoritative parent placement when an ending commits. */
export const QuestPlacement = Schema.Struct({
  workspaceId: Schema.NullOr(WorkspaceId),
  workspaceName: Schema.NullOr(Schema.String),
});
export type QuestPlacement = typeof QuestPlacement.Type;

/** An active quest the owner can choose to move to the Borderlands instead of archiving it with its realm. */
export const RealmArchiveQuest = Schema.Struct({ id: MissionId, isWorking: Schema.Boolean, title: Schema.String });
export type RealmArchiveQuest = typeof RealmArchiveQuest.Type;

/** A Ritual of the realm, which an archive switches off and keeps. */
export const RealmArchiveRitual = Schema.Struct({ id: RitualId, isOn: Schema.Boolean, title: Schema.String });
export type RealmArchiveRitual = typeof RealmArchiveRitual.Type;

/** A realm's archive state and the exact contents a confirmation covers. */
export const RealmArchivePreview = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.Number),
  loreCount: Schema.Int,
  /** Every quest of the realm, archived earlier or not; Rituals' quests are not among them. */
  questCount: Schema.Int,
  /** The quests an archive would still end: the owner may move any that is not at work to the Borderlands. */
  quests: Schema.Array(RealmArchiveQuest),
  realm: WorkspaceChoice,
  rituals: Schema.Array(RealmArchiveRitual),
  snapshot: Schema.String,
  workingCount: Schema.Int,
});
export type RealmArchivePreview = typeof RealmArchivePreview.Type;

/**
 * Makes a realm, asking before a duplicate active name is accepted. With `shouldAnswerOutcome`, the host checks and
 * makes it in one transaction and answers a `RealmCreation`; without it (an earlier app), it answers null and refuses
 * a duplicate name with an error, as before (CHG-0317).
 */
export const CreateRealm = Schema.TaggedStruct("CreateRealm", {
  ...RealmAppearance.fields,
  allowDuplicateName: Schema.optional(Schema.Boolean),
  path: Schema.NullOr(Schema.String),
  shouldAnswerOutcome: Schema.optional(Schema.Boolean),
});
/** Creates a repository under a chosen parent and attaches it to a realm. */
export const CreateRepositoryRealm = Schema.TaggedStruct("CreateRepositoryRealm", {
  allowDuplicateName: Schema.Boolean,
  name: NameText,
  parent: Schema.String,
  source: Schema.Union([
    Schema.TaggedStruct("Project", {}),
    Schema.TaggedStruct("GitUrl", { url: Schema.String }),
    Schema.TaggedStruct("GitHub", { repository: Schema.String }),
  ]),
});
/** Renames a realm without treating its name as its identity. */
export const RenameRealm = Schema.TaggedStruct("RenameRealm", {
  allowDuplicateName: Schema.optional(Schema.Boolean),
  name: NameText,
  workspaceId: WorkspaceId,
});
/**
 * Puts the listed realms in this order in the sidebar (the owner drags one past another). Realms left out keep their
 * place after those listed; an archived or unknown realm is refused.
 */
export const ReorderRealms = Schema.TaggedStruct("ReorderRealms", { workspaceIds: Schema.Array(WorkspaceId) });
/** Previews the quests, lore and working threads covered by a realm archive. */
export const PreviewRealmArchive = Schema.TaggedStruct("PreviewRealmArchive", { workspaceId: WorkspaceId });
/**
 * Archives a realm only when its confirmed contents are unchanged: the quests named in `movedQuestIds` go to the
 * Borderlands with their trees, the others are archived with the realm, and its Rituals are switched off.
 */
export const ArchiveRealm = Schema.TaggedStruct("ArchiveRealm", {
  movedQuestIds: Schema.optional(Schema.Array(MissionId)),
  snapshot: Schema.String,
  workspaceId: WorkspaceId,
});
/** Lists archived realms, including empty ones, for recovery. */
export const ListArchivedRealms = Schema.TaggedStruct("ListArchivedRealms", {});
/** Finds an archived realm by the chosen folder's resolved path. */
export const FindArchivedRealm = Schema.TaggedStruct("FindArchivedRealm", { path: Schema.String });
/** Restores a realm or starts it afresh with old quests kept archived and recoverably deleted realm lore. */
export const RestoreRealm = Schema.TaggedStruct("RestoreRealm", {
  allowDuplicateName: Schema.optional(Schema.Boolean),
  appearance: Schema.NullOr(RealmAppearance),
  shouldStartAfresh: Schema.Boolean,
  snapshot: Schema.String,
  workspaceId: WorkspaceId,
});

/**
 * What one realm creation came to (CHG-0317): made (or the folder's active realm, left as it is); the folder's archived
 * realm, offered for recovery and never made a second time; or a name another active realm carries, made only once
 * the owner confirms it with `allowDuplicateName`.
 */
export const RealmCreation = Schema.Union([
  Schema.TaggedStruct("Created", {}),
  Schema.TaggedStruct("ArchivedMatch", { archived: RealmArchivePreview }),
  Schema.TaggedStruct("NameTaken", { name: Schema.String }),
]);
export type RealmCreation = typeof RealmCreation.Type;

/** Realm lifecycle requests kept together at the transport boundary. */
export const realmRequests = [
  CreateRealm,
  CreateRepositoryRealm,
  RenameRealm,
  ReorderRealms,
  PreviewRealmArchive,
  ArchiveRealm,
  ListArchivedRealms,
  FindArchivedRealm,
  RestoreRealm,
] as const;
/** The wire result of each realm lifecycle request. */
export const realmResults = {
  ArchiveRealm: Schema.Null,
  // Null for an earlier app's request, which does not ask for the outcome, and from an earlier host, which ignores the ask.
  CreateRealm: Schema.NullOr(RealmCreation),
  CreateRepositoryRealm: RealmCreation,
  FindArchivedRealm: Schema.NullOr(RealmArchivePreview),
  ListArchivedRealms: Schema.Array(RealmArchivePreview),
  PreviewRealmArchive: RealmArchivePreview,
  RenameRealm: Schema.Null,
  ReorderRealms: Schema.Null,
  RestoreRealm: Schema.Null,
};
