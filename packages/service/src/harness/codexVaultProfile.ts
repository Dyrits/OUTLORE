import type { GitGrants } from "./codexGitGrants.ts";

/**
 * The Codex permission profile that hides the Vault's folder (ADR 0022) and, in a Git repository, lets commands stage
 * and commit (ADR 0025). It extends the built-in `:workspace` profile, which grants what `workspace-write` grants
 * (the thread's folder, `/tmp` and the temporary folder; no home folder), opens the network as the adapter's
 * `workspace-write` setting does, and adds a `deny` entry for the folder and the Git grants. Read from the 0.170.0
 * schema and tried with `codex sandbox` and `thread/start` on 2026-11-19
 * (documentation/verification/2026-11-19-vault-read-denial.md); no live Codex turn was run.
 */
export const vaultProfileName = "outlore";

/** The dotted config keys, as `thread/start` takes them in `config`, that define the profile for one Vault folder. */
export const vaultProfileConfigOf = (folder: string | null, grants: GitGrants = {}) => ({
  [`permissions.${vaultProfileName}.extends`]: ":workspace",
  [`permissions.${vaultProfileName}.filesystem`]: { ...grants, ...(folder === null ? {} : { [folder]: "deny" }) },
  [`permissions.${vaultProfileName}.network`]: { enabled: true },
});

/** The same profile as `-c key=value` arguments of `codex sandbox`, which parses each value as TOML. */
export const vaultProfileArgsOf = (folder: string | null, grants: GitGrants = {}) =>
  Object.entries(vaultProfileConfigOf(folder, grants)).flatMap(([key, value]) => [
    "-c",
    `${key}=${typeof value === "string" ? JSON.stringify(value) : tomlOf(value)}`,
  ]);

/** An inline TOML table of strings and booleans, which is all the profile holds. */
const tomlOf = (table: Readonly<Record<string, string | boolean>>) =>
  `{${Object.entries(table)
    .map(([key, value]) => `${JSON.stringify(key)}=${JSON.stringify(value)}`)
    .join(",")}}`;
