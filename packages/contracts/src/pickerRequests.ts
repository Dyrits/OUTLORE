import { Schema } from "effect";

// The folder picker (CHG-0253): browsing, searching, and making folders. A paired device reaches only the browsable roots the host set in the Workshop; the host's own window may reach any folder.
/** Lists a folder's subfolders (under the browsable roots for a paired device); null lists the roots. */
export const BrowseFolders = Schema.TaggedStruct("BrowseFolders", {
  path: Schema.NullOr(Schema.String),
  /** Whether folders whose names start with a dot are listed too (Show hidden). */
  shouldIncludeHidden: Schema.Boolean,
});
/** The skills a message in a workspace (or none) can name with a slash; the workspace's win over global ones. */
export const ListSkills = Schema.TaggedStruct("ListSkills", { workspacePath: Schema.NullOr(Schema.String) });
/** The files and folders of a workspace that a typed `@` can name, best matches first; refused for a folder that is not a workspace. */
export const ListWorkspaceEntries = Schema.TaggedStruct("ListWorkspaceEntries", {
  /** What follows the `@`: part of a name or of a path inside the workspace; empty lists the top level. */
  query: Schema.String,
  workspacePath: Schema.String,
});
/** The quests, errands, and realms a typed `@` can name: none archived, and never Chronicler's own (CHG-0181). */
export const ListMentionables = Schema.TaggedStruct("ListMentionables", {});
/** The models of every signed-in account a typed `@` can ask (thread-messaging, Mentioning a Companion with @): one row per account and model. */
export const ListCompanions = Schema.TaggedStruct("ListCompanions", {});
/** Makes a folder inside a browsable folder (New folder). */
export const CreateFolder = Schema.TaggedStruct("CreateFolder", { name: Schema.String, parent: Schema.String });
/** Adds an existing folder to the browsable roots (Add root); only the host itself may. */
export const AddBrowsableRoot = Schema.TaggedStruct("AddBrowsableRoot", { path: Schema.String });
/** Removes a folder from the browsable roots (Remove root); only the host itself may. */
export const RemoveBrowsableRoot = Schema.TaggedStruct("RemoveBrowsableRoot", { path: Schema.String });
/**
 * Folders matching what was typed, best first: a typed path that exists, then names that match exactly, by prefix, by
 * part, and loosely. An empty query lists the folders quests already used, newest first.
 */
export const SearchFolders = Schema.TaggedStruct("SearchFolders", { query: Schema.String });
