import { realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

/** A path resolved through links as far as it exists; the rest is taken as written. */
const realOf = (path: string): string => {
  try {
    return realpathSync(path);
  } catch {
    const parent = dirname(path);
    return parent === path ? path : join(realOf(parent), path.slice(parent.length).replace(/^[\\/]+/, ""));
  }
};

/**
 * Whether a path lies in the Vault's folder, after resolving links: Claude Code's own Read, Grep and Glob run outside
 * its command sandbox, so Outlore's prompt policy refuses any whose path is here (ADR 0022).
 */
export const isInsideVaultFolder = (folder: string, path: string, cwd: string) => {
  const inside = relative(realOf(resolve(folder)), realOf(resolve(cwd, path)));
  return inside === "" || (!inside.startsWith("..") && !isAbsolute(inside));
};

/**
 * Whether a search rooted at `root` could reach the Vault's folder: Grep and Glob walk a whole tree, so the root
 * being the folder itself or anything above it reaches in, as a link to either does (resolved as far as it exists).
 * The root being inside the folder is `isInsideVaultFolder`'s to say.
 */
export const searchReachesVaultFolder = (folder: string, root: string, cwd: string) => {
  const reach = relative(realOf(resolve(cwd, root)), realOf(resolve(folder)));
  return reach === "" || (!reach.startsWith("..") && !isAbsolute(reach));
};
