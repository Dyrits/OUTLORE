import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Config, Effect, Option } from "effect";
import { wrappedFencedCommandOf } from "../core/index.ts";
import { packageCacheFolders } from "./claudeArgs.ts";

// OpenCode has no sandbox of its own, so Outlore starts `opencode acp` inside the host's (CHG-0208): Seatbelt through
// `sandbox-exec` on macOS, bubblewrap on Linux. Writes are allowed only to the thread's folder, the package caches, and
// the service's own folders for OpenCode's state, configuration, cache, temporary files and data; the network stays
// open. Every process OpenCode starts, its `serve` child and the commands it runs, inherits the sandbox. Its data folder
// (sign-ins, sessions) is a copy per account, seeded from the account's real one at each start (openCodeSeed.ts) and
// read by no OpenCode run outside the sandbox: the real data folder, which the owner's own OpenCode and Outlore's probes
// read, is never writable from inside, so nothing planted there runs outside the sandbox.

/** How OpenCode is wrapped on this host. */
export type OpenCodeSandbox = {
  /** Folders commands may also write, such as package caches. */
  readonly caches: ReadonlyArray<string>;
  /** The sandbox tool: `/usr/bin/sandbox-exec` or `bwrap`. */
  readonly command: string;
  /** The folder holding the owner's own OpenCode configuration (`$XDG_CONFIG_HOME`), copied read-only at each start. */
  readonly computerConfigHome: string;
  /** The folder holding OpenCode's own data on this computer (`$XDG_DATA_HOME`): the "This computer" account's. */
  readonly computerDataHome: string;
  /** Folders no process inside may read, by real path: the Vault's (ADR 0022). */
  readonly hidden: ReadonlyArray<string>;
  readonly kind: "seatbelt" | "bwrap";
  /**
   * The service's folder for OpenCode's state, configuration, cache, temporary files and data copies, each in a folder
   * of its own; the folder itself, holding the process marker, is not writable from inside.
   */
  readonly root: string;
};

/** The package caches a wrapped OpenCode's commands may write, as the Claude Code sandbox allows them (claudeArgs.ts). */
export const packageCachesOf = (home: string) => packageCacheFolders.map((folder) => join(home, folder));

const findExecutable = (name: string) => {
  try {
    return execFileSync("which", [name], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

/** Whether the sandbox tool starts a trivial command, so a broken one counts as missing. */
const probeCommand = (command: string, args: ReadonlyArray<string>) => {
  try {
    return spawnSync(command, [...args], { stdio: "ignore", timeout: 5000 }).status === 0;
  } catch {
    return false;
  }
};

/** The computer's XDG config and data folders, as the environment names them. */
export type XdgHomes = { readonly config?: string; readonly data?: string };

/** Reads `XDG_CONFIG_HOME` and `XDG_DATA_HOME`, leaving out a folder the environment does not name. */
export const xdgHomesOf = Effect.gen(function* () {
  const config = yield* Config.String("XDG_CONFIG_HOME").pipe(Config.option, Effect.orDie);
  const data = yield* Config.String("XDG_DATA_HOME").pipe(Config.option, Effect.orDie);
  return {
    ...(Option.isSome(config) ? { config: config.value } : {}),
    ...(Option.isSome(data) ? { data: data.value } : {}),
  } satisfies XdgHomes;
});

/**
 * The sandbox OpenCode runs in here, or null when none can: then every action OpenCode asks about asks the owner, as
 * before. The host's sandbox problem (core/sandbox.ts) counts too, so the harnesses agree on whether one runs.
 */
export const detectOpenCodeSandbox = (host: {
  readonly platform: NodeJS.Platform;
  readonly root: string;
  readonly sandboxProblem: string | null;
  readonly caches?: ReadonlyArray<string>;
  /** The computer's XDG config and data folders, as `xdgHomesOf` reads them; under the home folder when left out. */
  readonly homes?: XdgHomes;
  /** Folders to hide from reading, such as the Vault's; each is made (mode 0700) if missing, so bubblewrap can cover it. */
  readonly hidden?: ReadonlyArray<string>;
  readonly which?: (name: string) => string | null;
  readonly probe?: (command: string, args: ReadonlyArray<string>) => boolean;
}): OpenCodeSandbox | null => {
  if (host.sandboxProblem !== null) return null;
  const facts = {
    caches: host.caches ?? packageCachesOf(homedir()),
    computerConfigHome: host.homes?.config ?? join(homedir(), ".config"),
    computerDataHome: host.homes?.data ?? join(homedir(), ".local", "share"),
    hidden: (host.hidden ?? []).map((folder) => makeRealFolder(folder, 0o700)),
    root: host.root,
  };
  const probe = host.probe ?? probeCommand;
  if (host.platform === "darwin") {
    const command = "/usr/bin/sandbox-exec";
    if (!existsSync(command) || !probe(command, ["-p", "(version 1)(allow default)", "/usr/bin/true"])) return null;
    return { ...facts, command, kind: "seatbelt" };
  }
  if (host.platform === "linux") {
    const command = (host.which ?? findExecutable)("bwrap");
    if (command === null || !probe(command, ["--ro-bind", "/", "/", "--", "/bin/true"])) return null;
    return { ...facts, command, kind: "bwrap" };
  }
  return null;
};

/** The service's own folders a wrapped OpenCode writes, besides its data copies. */
const sharedParts = ["tmp", "cache", "config", "state"] as const;

/** The folder of the account's data copy below the sandbox's: "computer", or one named after the account's folder. */
const accountPartOf = (accountDataHome: string | null) =>
  accountDataHome === null
    ? "computer"
    : `account-${createHash("sha256").update(accountDataHome).digest("hex").slice(0, 16)}`;

/** The account's own data copy a wrapped OpenCode reads and writes as its `$XDG_DATA_HOME`, never its real one. */
export const sandboxDataHomeOf = (sandbox: OpenCodeSandbox, accountDataHome: string | null) =>
  join(sandbox.root, "data", accountPartOf(accountDataHome));

/** The account's real data folder (`$XDG_DATA_HOME`): its own folder, or OpenCode's own for this computer. */
export const realDataHomeOf = (sandbox: OpenCodeSandbox, accountDataHome: string | null) =>
  accountDataHome ?? sandbox.computerDataHome;

/** The environment a wrapped OpenCode starts with: every folder it writes in the service's folder. */
export const openCodeEnvironmentOf = (sandbox: OpenCodeSandbox, accountDataHome: string | null) => ({
  TMPDIR: join(sandbox.root, "tmp"),
  XDG_CACHE_HOME: join(sandbox.root, "cache"),
  XDG_CONFIG_HOME: join(sandbox.root, "config"),
  XDG_DATA_HOME: sandboxDataHomeOf(sandbox, accountDataHome),
  XDG_STATE_HOME: join(sandbox.root, "state"),
});

/** A folder made if missing, by its real path, which Seatbelt matches (`/var` is `/private/var` on macOS). */
const makeRealFolder = (path: string, mode = 0o755) => {
  mkdirSync(path, { mode, recursive: true });
  return realpathSync(path);
};

/**
 * One of the service's own folders below the sandbox's, made if missing and a plain folder all the way down: anything
 * else in its place, such as a link a sandboxed process planted to widen what the next start may write, is removed
 * first. Returned by its real path, checked to be where it should be.
 */
const makeOwnedFolder = (root: string, parts: ReadonlyArray<string>, mode = 0o755) => {
  let path = makeRealFolder(root);
  for (const part of parts) {
    path = join(path, part);
    const found = lstatSync(path, { throwIfNoEntry: false });
    if (found !== undefined && !found.isDirectory()) rmSync(path, { force: true });
    if (found === undefined || !found.isDirectory()) mkdirSync(path, { mode });
  }
  if (realpathSync(path) !== path) throw new Error(`OpenCode's sandbox folder ${path} is not where it should be.`);
  return path;
};

/**
 * The folders a wrapped OpenCode may write: the thread's folder, the service's own folders and the account's data copy
 * (only the owner may read it), and the caches. Never the account's real data folder, nor the service's folder itself.
 */
export const writableRootsOf = (sandbox: OpenCodeSandbox, cwd: string, accountDataHome: string | null) => [
  makeRealFolder(cwd),
  ...sharedParts.map((part) => makeOwnedFolder(sandbox.root, [part])),
  makeOwnedFolder(sandbox.root, ["data", accountPartOf(accountDataHome)], 0o700),
  ...sandbox.caches.filter((cache) => existsSync(cache)).map((cache) => realpathSync(cache)),
];

/**
 * The marker every sandboxed OpenCode process the service starts carries in its environment, inherited by all it
 * starts (processTree.ts sweepOrphans): a random id kept in the service's folder, which the sandbox cannot write.
 */
export const writeOwnerMarker = (sandbox: OpenCodeSandbox) => {
  const path = join(makeRealFolder(sandbox.root), "owner");
  if (!existsSync(path)) {
    try {
      writeFileSync(path, randomUUID(), { flag: "wx", mode: 0o600 });
    } catch {
      // Made meanwhile by another start.
    }
  }
  return { name: "OUTLORE_SANDBOX_OWNER", value: readFileSync(path, "utf8").trim() };
};

/**
 * The command line that starts `command` inside the sandbox, writing only to the given folders and reading none of the
 * hidden ones; the profile itself is shared with the conversation terminals (core/wrappedSandbox.ts).
 */
export const wrappedCommandOf = (
  sandbox: OpenCodeSandbox,
  writable: ReadonlyArray<string>,
  command: string,
  args: ReadonlyArray<string>,
) => wrappedFencedCommandOf(sandbox, writable, command, args);
