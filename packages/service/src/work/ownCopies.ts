import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join, resolve } from "node:path";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, realFolderOf } from "../core/index.ts";

// Own copy (workspace-attachment, CHG-0441): a thread's own git worktree of its git workspace, on its own branch. The
// service makes it, outside any sandbox, because Claude Code's sandbox never writes `.git/worktrees` of the folder a
// thread starts in: a thread making one itself asks the owner, and so does every commit it makes in one from the
// checkout. Started inside its own copy, a thread's sandbox writes the copy's git records (probe of 2026-11-17).

/** A thread's own copy: the worktree's real path and its branch. */
export type OwnCopy = {
  readonly branch: string;
  readonly path: string;
};

/** The folder, inside the workspace, that holds its own copies; git-ignored through the repository's exclude file. */
export const ownCopiesFolder = ".worktrees";

/** The thread's own copy, inherited or its own, with whether its folder still exists; null when it has none. */
export const readOwnCopy = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ branch: string | null; path: string | null }>`
      SELECT own_copy AS path, own_copy_branch AS branch FROM threads WHERE id = ${threadId}`;
  if (row === undefined || row.path === null || row.branch === null) return null;
  const isMissing = (yield* realFolderOf(row.path)) === null;
  return { branch: row.branch, isMissing, path: row.path };
});

/**
 * The own copy a new thread beneath `parentId` works in: a new one when the opener asked for it, otherwise its
 * parent's, shared, or none. A new copy starts from the commit the parent works on (the parent's own copy, or the
 * workspace), so a thread can hand part of its branch's work to a thread beneath it.
 */
export const ownCopyForChild = Effect.fnUntraced(function* (
  parentId: string,
  threadId: string,
  isOwnCopyAsked: boolean,
) {
  const sql = yield* SqlClient.SqlClient;
  const parentCopy = yield* readOwnCopy(parentId);
  if (!isOwnCopyAsked) return parentCopy === null ? null : { branch: parentCopy.branch, path: parentCopy.path };
  const [row] = yield* sql<{ title: string; workspace: string | null }>`
      SELECT m.title, w.path AS workspace FROM threads t JOIN missions m ON m.id = t.mission_id
        LEFT JOIN workspaces w ON w.id = t.workspace_id WHERE t.id = ${parentId}`;
  if (row === undefined || row.workspace === null)
    return yield* invalid("Not opened: an own copy needs a workspace, and this quest has none.");
  return yield* createOwnCopy(row.workspace, parentCopy?.path ?? row.workspace, ownCopyNameOf(row.title, threadId));
});

/** A name made of lower-case letters, digits, and dashes, for a folder and a branch, from a title and an id. */
export const ownCopyNameOf = (title: string, threadId: string) => {
  const words = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  const id = threadId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toLowerCase();
  return words === "" ? id : `${words}-${id}`;
};

/** Runs git in a folder: its trimmed output, or the reason it failed in git's words. */
const runGit = (folder: string, args: ReadonlyArray<string>) => {
  try {
    const output = execFileSync("git", ["-C", folder, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 30_000,
    });
    return { isDone: true, text: output.trim() } as const;
  } catch (error) {
    const stderr = (error as Error & { stderr?: unknown }).stderr;
    const text = typeof stderr === "string" && stderr.trim() !== "" ? stderr.trim() : (error as Error).message;
    return { isDone: false, text } as const;
  }
};

const realPathOrNull = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return null;
  }
};

/** Keeps `.worktrees/` out of the repository's status when the repository does not ignore it already. */
const excludeOwnCopies = (workspace: string) => {
  if (runGit(workspace, ["check-ignore", "-q", `${ownCopiesFolder}/probe`]).isDone) return;
  const common = runGit(workspace, ["rev-parse", "--git-common-dir"]);
  if (!common.isDone) return;
  const info = join(resolve(workspace, common.text), "info");
  mkdirSync(info, { recursive: true });
  const exclude = join(info, "exclude");
  const before = existsSync(exclude) ? readFileSync(exclude, "utf8") : "";
  appendFileSync(exclude, `${before === "" || before.endsWith("\n") ? "" : "\n"}/${ownCopiesFolder}/\n`);
};

/**
 * Makes an own copy of the workspace: a git worktree at `<workspace>/.worktrees/<name>` on a new branch
 * `mission/<name>`, started from the commit checked out in `baseFolder` (the opener's folder: the workspace, or the
 * opener's own copy). Refused with the reason when the workspace is not the top folder of a git repository, or git
 * refuses; the installed packages are not copied, the workspace's own instructions say how to prepare a worktree.
 */
export const createOwnCopy = (workspace: string, baseFolder: string, name: string) =>
  Effect.gen(function* () {
    const top = yield* Effect.sync(() => runGit(workspace, ["rev-parse", "--show-toplevel"]));
    if (!top.isDone || realPathOrNull(top.text) !== realPathOrNull(workspace))
      return yield* invalid("Not opened: an own copy needs a workspace that is the top folder of a git repository.");
    const base = yield* Effect.sync(() => runGit(baseFolder, ["rev-parse", "--verify", "HEAD^{commit}"]));
    if (!base.isDone) return yield* invalid("Not opened: the workspace has no commit to start an own copy from.");
    const path = join(workspace, ownCopiesFolder, name);
    const branch = `mission/${name}`;
    yield* Effect.sync(() => excludeOwnCopies(workspace));
    const added = yield* Effect.sync(() => runGit(workspace, ["worktree", "add", "-b", branch, path, base.text]));
    if (!added.isDone) return yield* invalid(`Not opened: git could not make the own copy: ${added.text}`);
    return { branch, path: realPathOrNull(path) ?? path } satisfies OwnCopy;
  });
