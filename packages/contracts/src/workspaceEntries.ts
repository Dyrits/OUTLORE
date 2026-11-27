import { Schema } from "effect";

// What a typed `+` in a message can name inside a workspace.

/** A file or folder of a workspace; the path is relative to the workspace and a folder's ends with a slash. */
export const WorkspaceEntry = Schema.Struct({
  kind: Schema.Literals(["file", "folder"]),
  path: Schema.String,
});
export type WorkspaceEntry = typeof WorkspaceEntry.Type;
