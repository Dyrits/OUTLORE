import { mkdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Workspace, WorkspaceId } from "@outlore/contracts";
import { Clock, Context, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, newId, realFolderOf } from "../core/index.ts";
import { readMissionIdOf } from "./lifecycle.ts";
import { type OwnCopy, readOwnCopy } from "./ownCopies.ts";
import { requireActiveRealm } from "./realmAccess.ts";
import { validateRealmName } from "./realmNames.ts";

/**
 * Makes a realm with the given name: from a folder, where an existing realm for the folder is left as it is,
 * or tied to no folder (a null path), refused for a blank name.
 */
export const createRealm = Effect.fnUntraced(function* (
  path: string | null,
  name: string,
  shouldAllowDuplicateName = false,
) {
  const sql = yield* SqlClient.SqlClient;
  const folder = path === null ? null : yield* requireFolder(path);
  const [existing] =
    folder === null ? [] : yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${folder}`;
  const trimmed = yield* validateRealmName(
    name.trim() || (folder === null ? "" : basename(folder)),
    existing?.id ?? null,
    shouldAllowDuplicateName,
  );
  if (folder !== null) return yield* attachWorkspace(folder, { name: trimmed }).pipe(Effect.as(null));
  const now = yield* Clock.currentTimeMillis;
  const id = yield* newId;
  yield* sql`INSERT INTO workspaces (id, name, path, created_at)
        VALUES (${id}, ${trimmed}, NULL, ${now})`;
  return null;
});

/** Renames a realm; refused for an unknown realm or a blank name. */
export const renameRealm = Effect.fnUntraced(function* (
  workspaceId: WorkspaceId,
  name: string,
  shouldAllowDuplicateName = false,
) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE id = ${workspaceId}`;
  if (row === undefined) return yield* invalid("No such realm.");
  const trimmed = yield* validateRealmName(name, workspaceId, shouldAllowDuplicateName);
  yield* sql`UPDATE workspaces SET name = ${trimmed} WHERE id = ${workspaceId}`;
  return null;
});

/** Where each mission's threads with no workspace run, one scratch folder per mission. */
export class ScratchRoot extends Context.Service<ScratchRoot, string>()("outlore/ScratchRoot") {}

/** The existing folder at the path, with links resolved; refused otherwise. */
const requireFolder = Effect.fnUntraced(function* (path: string) {
  const real = yield* realFolderOf(path);
  if (real === null) return yield* invalid(`No folder at ${path}.`);
  return real;
});

/**
 * The workspace for a chosen folder: the existing one for that folder, or a new one,
 * since a folder becomes a workspace the first time it is chosen. Callers run it in a transaction.
 */
export const attachWorkspace = Effect.fnUntraced(function* (path: string, realm: { name: string } | null = null) {
  const sql = yield* SqlClient.SqlClient;
  // Any folder the owner chose in the system's folder dialog (CHG-0035).
  const folder = yield* requireFolder(path);
  const [existing] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${folder}`;
  if (existing !== undefined) {
    yield* requireActiveRealm(existing.id);
    return existing.id;
  }
  const id = yield* newId;
  const now = yield* Clock.currentTimeMillis;
  const name = realm?.name.trim() || basename(folder) || folder;
  yield* sql`INSERT INTO workspaces (id, name, path, created_at)
      VALUES (${id}, ${name}, ${folder}, ${now})`;
  return id;
});

/**
 * A thread's workspace with whether its folder still exists, or null for the scratch folder: a thread with no realm,
 * or in a realm tied to no folder, has no workspace.
 */
export const readThreadWorkspace = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ id: string; name: string; path: string }>`
      SELECT w.id, w.name, w.path FROM threads t JOIN workspaces w ON w.id = t.workspace_id
      WHERE t.id = ${threadId} AND w.path IS NOT NULL`;
  if (row === undefined) return null;
  const isMissing = (yield* realFolderOf(row.path)) === null;
  return { id: row.id as WorkspaceId, isMissing, name: row.name, path: row.path } satisfies Workspace;
});

/** The folder a thread works in: its own copy, its workspace's, or its mission's scratch folder; null for an unknown thread. */
export const threadFolderOf = Effect.fnUntraced(function* (threadId: string) {
  const missionId = yield* readMissionIdOf(threadId);
  if (missionId === null) return null;
  const ownCopy = yield* readOwnCopy(threadId);
  if (ownCopy !== null) return ownCopy.path;
  const workspace = yield* readThreadWorkspace(threadId);
  return workspace?.path ?? join(yield* ScratchRoot, missionId);
});

// Instruction files a harness started without its own settings does not read (probe, 2026-11-06:
// Claude Code 2.1.302 with `--setting-sources ""` ignores the folder's CLAUDE.md).
const instructionFiles = ["AGENTS.md", "CLAUDE.md"];
/** Keeps the harness's command line well under the system's argument limit. */
const instructionLimit = 50_000;

const readInstructions = (folder: string) =>
  Effect.sync(() =>
    instructionFiles.flatMap((name) => {
      let text: string;
      try {
        text = readFileSync(join(folder, name), "utf8").trim();
      } catch {
        return [];
      }
      if (text === "") return [];
      const body =
        text.length > instructionLimit ? `${text.slice(0, instructionLimit)}\n[cut: the file is longer]` : text;
      return [`## ${name}\n${body}`];
    }),
  );

/** The lines saying the thread works in its own copy of the workspace, and what to do with its branch. */
const ownCopyLinesOf = (workspace: Workspace, ownCopy: OwnCopy) => [
  `You work in your own copy of the workspace "${workspace.name}": the git worktree at ${ownCopy.path}, on the branch ${ownCopy.branch}, made from ${workspace.path}. It is your working folder; work and commit there, never in ${workspace.path}.`,
  "Commit your work on your branch, and name the branch in your result so the thread that opened you can merge it. Threads you open share your copy unless you ask for their own.",
  "Your copy has no installed packages: prepare it as the instructions below say for a worktree, or install them.",
];

/** The starting context naming the thread's workspace or its own copy of it, with the folder's own instructions. */
const workspaceContextOf = Effect.fnUntraced(function* (workspace: Workspace, ownCopy: OwnCopy | null) {
  const instructions = yield* readInstructions(ownCopy?.path ?? workspace.path);
  return [
    "# Your workspace",
    ...(ownCopy === null
      ? [`You work in the workspace "${workspace.name}" at ${workspace.path}. It is your working folder.`]
      : ownCopyLinesOf(workspace, ownCopy)),
    ...(instructions.length === 0
      ? []
      : ["The workspace's own instructions follow; follow them for work in this folder.", ...instructions]),
  ].join("\n");
});

/**
 * Where a thread works and the starting context saying so: its own copy of its workspace, its workspace's folder, or
 * its mission's scratch folder when it has none. Only describes the folder; `prepareWorkingFolder` makes it.
 */
export const workingFolderOf = (workspace: Workspace | null, scratchFolder: string, ownCopy: OwnCopy | null = null) =>
  workspace === null
    ? Effect.succeed({
        context: [
          "# Your working folder",
          `You have no workspace. You work in your quest's scratch folder, ${scratchFolder}, shared with the quest's other threads that have none.`,
        ].join("\n"),
        cwd: scratchFolder,
      })
    : workspaceContextOf(workspace, ownCopy).pipe(
        Effect.map((context) => ({ context, cwd: ownCopy?.path ?? workspace.path })),
      );

/** Where a thread works and the starting context saying so, with the scratch folder made on first use. */
export const prepareWorkingFolder = (
  workspace: Workspace | null,
  scratchFolder: string,
  ownCopy: OwnCopy | null = null,
) =>
  (workspace === null ? Effect.sync(() => void mkdirSync(scratchFolder, { recursive: true })) : Effect.void).pipe(
    Effect.andThen(workingFolderOf(workspace, scratchFolder, ownCopy)),
  );
