import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * What Codex's permission profile grants for the thread folder's Git repository (ADR 0025). Codex's workspace sandbox
 * keeps `.git` read-only, so `git add` fails with "Unable to create '.git/index.lock': Operation not permitted" and
 * every commit asks the owner to leave the sandbox. The repository's Git folders are made writable, except the files
 * Git runs or obeys outside the sandbox: `hooks` and `config` of each Git folder, the repository's own and its
 * submodules'. A command can then stage and commit, but cannot plant a hook that runs on the owner's next commit.
 * Verified with `codex sandbox` on codex-cli 0.171.0, 2026-11-20.
 */
export type GitGrants = Readonly<Record<string, "read" | "write">>;

const isDirectory = (path: string) => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

/** The real path, which Codex's profile needs: it refuses a writable root that holds a link. */
const realOf = (path: string) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** The folder holding `.git` for a folder, found upward, and the `.git` entry itself; null outside a repository. */
const dotGitOf = (folder: string): string | null => {
  for (let current = resolve(folder); ; current = dirname(current)) {
    const candidate = join(current, ".git");
    if (existsSync(candidate)) return candidate;
    if (dirname(current) === current) return null;
  }
};

/** A repository's own Git folder and the shared one: a linked worktree's `.git` is a file naming its folder. */
const gitFoldersOf = (dotGit: string): { readonly own: string; readonly shared: string } | null => {
  try {
    if (isDirectory(dotGit)) return { own: dotGit, shared: dotGit };
    const named = /^gitdir:\s*(.+?)\s*$/m.exec(readFileSync(dotGit, "utf8"))?.[1];
    if (named === undefined) return null;
    const own = resolve(dirname(dotGit), named);
    const shared = existsSync(join(own, "commondir"))
      ? resolve(own, readFileSync(join(own, "commondir"), "utf8").trim())
      : own;
    return { own, shared };
  } catch {
    return null;
  }
};

/** The Git folders of the submodules under `modules`, which hold their own `hooks` and `config`. */
const moduleFoldersOf = (modules: string): ReadonlyArray<string> => {
  try {
    if (!lstatSync(modules).isDirectory()) return [];
    return readdirSync(modules, { withFileTypes: true }).flatMap((entry) => {
      if (!entry.isDirectory()) return [];
      const folder = join(modules, entry.name);
      // A slash in a submodule name adds a directory before its Git folder.
      if (!existsSync(join(folder, "HEAD"))) return moduleFoldersOf(folder);
      return [folder, ...moduleFoldersOf(join(folder, "modules"))];
    });
  } catch {
    return [];
  }
};

/** The grants for the repository a folder is in; empty outside a repository. */
export const gitGrantsOf = (folder: string): GitGrants => {
  const dotGit = dotGitOf(folder);
  const folders = dotGit === null ? null : gitFoldersOf(dotGit);
  if (folders === null) return {};
  const own = realOf(folders.own);
  const shared = realOf(folders.shared);
  const grants: Record<string, "read" | "write"> = { [own]: "write", [shared]: "write" };
  // Later entries are narrower paths, and a narrower entry wins over the folder that holds it.
  const gitFolders = new Set([own, shared].flatMap((root) => [root, ...moduleFoldersOf(join(root, "modules"))]));
  for (const gitFolder of gitFolders) {
    grants[join(gitFolder, "hooks")] = "read";
    grants[join(gitFolder, "config")] = "read";
  }
  return grants;
};
