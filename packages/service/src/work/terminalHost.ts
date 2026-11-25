import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import type { spawn } from "node-pty";
import { type FencedSandbox, vaultFolderOf } from "../core/index.ts";

// The host's own ways a conversation shell runs with (ADR 0012 amendment, ADR 0020): the shell it opens, the OS sandbox
// a paired device's shell runs in, and the folders the fence keeps apart. The shells themselves are in terminalSessions.ts.

/** How a shell is fenced: the host's own window runs it plainly, a paired device inside the OS sandbox. */
export type TerminalScope = "host" | "remote";

/** The Seatbelt (`sandbox-exec`) or bubblewrap (`bwrap`) sandbox a paired device's shell runs in. */
export type TerminalSandbox = FencedSandbox;

const require = createRequire(import.meta.url);

/**
 * The copy on disk of a path inside the packaged archive, where node-pty's native files are unpacked; other paths are
 * unchanged.
 */
export const unpackedPathOf = (path: string) => path.replace(`${sep}app.asar${sep}`, `${sep}app.asar.unpacked${sep}`);

/** Repairs missing executable permissions on node-pty's bundled Unix helper. */
export const prepareTerminalHelper = () => {
  if (process.platform === "win32") return;
  // Inside the packaged archive the helper cannot be changed, so its unpacked copy is the one to repair.
  const root = unpackedPathOf(dirname(require.resolve("node-pty/package.json")));
  for (const folder of [
    join(root, "prebuilds", `${process.platform}-${process.arch}`),
    join(root, "build", "Release"),
  ]) {
    const helper = join(folder, "spawn-helper");
    if (existsSync(helper) && (statSync(helper).mode & 0o111) === 0) chmodSync(helper, 0o755);
  }
};

/** The shell a terminal opens: the owner's login shell, or Windows' command shell, which has no login shell. */
export const defaultShellOf = (platform: NodeJS.Platform, loginShell: string | null, comspec: string | null): string =>
  platform === "win32" ? comspec || "cmd.exe" : loginShell || "/bin/sh";

/** A Unix login shell loads its start-up files for `-l`; the Windows command shell takes no such flag. */
export const shellArgsOf = (platform: NodeJS.Platform): string[] => (platform === "win32" ? [] : ["-l"]);

/** A folder made if missing and returned by its real path, which the sandbox's paths match. */
export const madeRealFolder = (folder: string, mode = 0o700) => {
  mkdirSync(folder, { mode, recursive: true });
  return realpathSync(folder);
};

/** Where a paired device's shell keeps temporary files, inside the fence and made if missing. */
export const terminalTempRootOf = (dataDirectory: string) => madeRealFolder(join(dataDirectory, "terminal-tmp"));

/** Whether the sandbox tool starts a trivial command, so a broken one counts as missing; the probe the harnesses use. */
const probesCommand = (command: string, args: ReadonlyArray<string>) => {
  try {
    return spawnSync(command, [...args], { stdio: "ignore", timeout: 5000 }).status === 0;
  } catch {
    return false;
  }
};

/**
 * The OS sandbox a paired device's shell runs in, or null when this host offers none: Seatbelt on macOS, bubblewrap on
 * Linux, probed the way the OpenCode sandbox is. Where no sandbox can run (Windows for now), terminals from paired
 * devices stay off (ADR 0020).
 */
export const terminalSandboxOf = (host: {
  readonly hidden: ReadonlyArray<string>;
  readonly platform: NodeJS.Platform;
  /** Replaced by a check, so a broken tool counts as missing without one on the host. */
  readonly probe?: (command: string, args: ReadonlyArray<string>) => boolean;
  /** Which executable a name names, for the Linux tool; the shell's own `which` when left out. */
  readonly which?: (name: string) => string | null;
}): TerminalSandbox | null => {
  const hidden = host.hidden.filter((folder) => existsSync(folder)).map((folder) => realpathSync(folder));
  const probe = host.probe ?? probesCommand;
  if (host.platform === "darwin") {
    const command = "/usr/bin/sandbox-exec";
    if (!probe(command, ["-p", "(version 1)(allow default)", "/usr/bin/true"])) return null;
    return { command, hidden, kind: "seatbelt" };
  }
  if (host.platform === "linux") {
    const command = (host.which ?? (() => null))("bwrap");
    if (command === null || !probe(command, ["--ro-bind", "/", "/", "--", "/bin/true"])) return null;
    return { command, hidden, kind: "bwrap" };
  }
  return null;
};

/** The host's own ways a conversation shell runs with, so a check can stand in for them. */
export type TerminalHost = {
  /** The environment shells start with; the service's own when left out. */
  readonly environment?: NodeJS.ProcessEnv;
  /** The folders no paired device's shell may read, such as the Vault's (ADR 0022). */
  readonly hidden: ReadonlyArray<string>;
  /** The folder a terminal starts in when its conversation names none. */
  readonly home: string;
  /** The platform the host runs on; the service's own when left out. */
  readonly platform?: NodeJS.Platform;
  /** The sandbox a paired device's shell runs in, or null when this host offers none. */
  readonly sandbox: TerminalSandbox | null;
  /** The shell a terminal opens; the owner's login shell when left out. */
  readonly shell?: string;
  /** The PTY spawner to use; node-pty's `spawn` when left out, so checks can stand in without an OS PTY. */
  readonly spawn?: typeof spawn;
  /** Where a paired device's shell keeps temporary files, inside the fence. */
  readonly tempRoot: string;
  /** Which executable a name names, for finding the Linux sandbox; the shell's own `which` when left out. */
  readonly which?: (name: string) => string | null;
};

/** Which executable a name names, as the shell's own `which` finds it. */
const whichOf = (name: string) => {
  try {
    return execFileSync("which", [name], { encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
};

/**
 * The host's own terminal ways: the owner's home and login shell, the OS sandbox it offers (or none, so terminals
 * from paired devices stay off), the Vault's folder hidden from every paired shell, and the terminals' own temporary
 * folder inside the fence. A check stands in for all of it with `terminalHost` options on the service (ADR 0020).
 */
export const hostTerminalHost = (home: string, dataDirectory: string): TerminalHost => {
  const hidden = [madeRealFolder(vaultFolderOf(dataDirectory))];
  return {
    hidden,
    home,
    platform: process.platform,
    sandbox: terminalSandboxOf({ hidden, platform: process.platform, which: whichOf }),
    tempRoot: terminalTempRootOf(dataDirectory),
  };
};
