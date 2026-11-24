import {
  addBrowsableRoot,
  browseFolders,
  createFolder,
  type FolderAccess,
  removeBrowsableRoot,
  searchFolders,
} from "../core/index.ts";
import { removePermission, widenPermission } from "../policy/index.ts";
import { listMentionables } from "./mentions.ts";
import { readPermissionsView } from "./permissionViews.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import { listSkills } from "./skills.ts";
import { listWorkspaceEntries } from "./workspaceEntries.ts";

/** Requests for the folders a thread may reach, the permissions granted on them, and what a workspace offers to mention. */
export const workspaceHandlers = (
  { change }: Pick<HandlerDependencies, "change">,
  folderAccess: FolderAccess,
  homeFolder: string,
) =>
  ({
    AddBrowsableRoot: (add) => change(addBrowsableRoot(add.path)),
    BrowseFolders: (browse) => browseFolders(browse.path, browse.shouldIncludeHidden, folderAccess),
    CreateFolder: (create) => createFolder(create.parent, create.name, folderAccess),
    ListMentionables: () => listMentionables,
    ListSkills: (given) => listSkills(given.workspacePath),
    ListWorkspaceEntries: (given) => listWorkspaceEntries(given.workspacePath, given.query),
    ReadPermissions: (read) => readPermissionsView(read.missionId),
    RemoveBrowsableRoot: (remove) => change(removeBrowsableRoot(remove.path)),
    RemovePermission: (remove) => change(removePermission(remove.permissionId)),
    SearchFolders: (search) => searchFolders(search.query, folderAccess, homeFolder),
    WidenPermission: (widen) => change(widenPermission(widen.permissionId)),
  }) satisfies OwnerHandlers<
    | "AddBrowsableRoot"
    | "BrowseFolders"
    | "CreateFolder"
    | "ListMentionables"
    | "ListSkills"
    | "ListWorkspaceEntries"
    | "ReadPermissions"
    | "RemoveBrowsableRoot"
    | "RemovePermission"
    | "SearchFolders"
    | "WidenPermission"
  >;
