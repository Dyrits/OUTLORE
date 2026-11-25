import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { realFolderOf } from "../core/index.ts";
import { folderMoveOf, mightMoveFolder } from "./folderMoves.ts";

// The folder a thread's own tool calls moved its shell to (conversation-terminal, Starting folder). The service keeps the
// last candidate the calls named, and decides what it counts as only when the thread is read, so a folder a command is
// still making, or one removed since, needs no care at the time of the call.

const isFolder = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** Git's answer for a folder, one line per question, or null when it fails (no git, not a repository). */
const gitLines = (folder: string, args: ReadonlyArray<string>) => {
  try {
    const output = execFileSync("git", ["-C", folder, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
    });
    return output.trim().split("\n");
  } catch {
    return null;
  }
};

/**
 * Records where a tool call moved the thread's shell: from where its last call left it while that folder exists, else
 * from `start`, the folder its turns start in. A call that moves nothing leaves it as it was.
 */
export const moveWorkingFolder = Effect.fnUntraced(function* (
  threadId: string,
  start: string,
  toolName: string,
  input: unknown,
) {
  if (!mightMoveFolder(toolName, input)) return;
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{
    folder: string | null;
  }>`SELECT working_folder AS folder FROM threads WHERE id = ${threadId}`;
  const stored = row?.folder ?? null;
  const from = stored !== null && isFolder(stored) ? stored : start;
  const move = folderMoveOf(toolName, input, from, start);
  if (move._tag === "Stays") return;
  yield* sql`UPDATE threads SET working_folder = ${move._tag === "MovesTo" ? move.path : null} WHERE id = ${threadId}`;
});

/**
 * The linked git worktree of the thread's workspace its calls last moved its shell into, as the worktree's real path, or
 * null: nothing moved it, it moved back to the workspace's own checkout, it left the workspace's repository, or the
 * folder is gone. A folder inside a worktree counts as the worktree.
 */
export const readWorkingFolder = Effect.fnUntraced(function* (threadId: string, workspace: string | null) {
  if (workspace === null) return null;
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{
    folder: string | null;
  }>`SELECT working_folder AS folder FROM threads WHERE id = ${threadId}`;
  if (row?.folder == null) return null;
  const folder = yield* realFolderOf(row.folder);
  const checkout = yield* realFolderOf(workspace);
  if (folder === null || checkout === null) return null;
  const here = gitLines(folder, [
    "rev-parse",
    "--path-format=absolute",
    "--show-toplevel",
    "--git-dir",
    "--git-common-dir",
  ]);
  const [top, gitDirectory, commonDirectory] = here ?? [];
  if (top === undefined || gitDirectory === undefined || commonDirectory === undefined) return null;
  // A checkout's git directory is the repository's own; a linked worktree's lies inside it, under `worktrees`.
  if (gitDirectory === commonDirectory) return null;
  const [workspaceCommon] = gitLines(checkout, ["rev-parse", "--path-format=absolute", "--git-common-dir"]) ?? [];
  return workspaceCommon === commonDirectory ? top : null;
});
