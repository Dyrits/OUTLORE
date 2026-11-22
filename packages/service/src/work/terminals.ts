import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { userInfo } from "node:os";
import { dirname, isAbsolute, join, sep } from "node:path";
import type { ServerFrame } from "@outlore/contracts";
import { Context, Effect, Layer } from "effect";
import { type IPty, spawn } from "node-pty";
import {
  type FencedSandbox,
  readSettings,
  ServiceFailure,
  Sessions,
  sessionsLayer,
  vaultFolderOf,
  wrappedFencedCommandOf,
} from "../core/index.ts";

// The owner's conversation shells, once the desktop window's own and now the host service's (ADR 0012 amendment,
// ADR 0020): every screen reaches the same shells through the service's requests. The host's own window opens the
// owner's full login shell, as before; a paired device may open and steer one only while the owner's "Allow terminals
// from paired devices" switch is on, and its shell runs inside the OS sandbox the harnesses run in, writing only
// inside the conversation's folder. A paired device's shell is shared by every paired device, and kept apart from the
// host window's, so a screen never sees a shell its fence does not cover.

/** How a shell is fenced: the host's own window runs it plainly, a paired device inside the OS sandbox. */
export type TerminalScope = "host" | "remote";

/** The Seatbelt (`sandbox-exec`) or bubblewrap (`bwrap`) sandbox a paired device's shell runs in. */
export type TerminalSandbox = FencedSandbox;

/** Why the service refused a terminal request, in the failure kinds the app tells apart. */
class TerminalFailure extends Error {
  constructor(
    readonly kind: "InvalidInput" | "Unsupported",
    message: string,
  ) {
    super(message);
  }
}

/** The shell it names a plain answer for; the sandbox's absence is the one refusal that is about the host. */
const sandboxMissing = () =>
  new TerminalFailure("Unsupported", "This computer offers no sandbox, so terminals from paired devices are off.");

const require = createRequire(import.meta.url);
const outputLimit = 200000;
const sessionsPerScope = 32;

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
export const defaultShellOf = (
  platform: NodeJS.Platform,
  loginShell: string | undefined,
  comspec: string | undefined,
): string => (platform === "win32" ? comspec || "cmd.exe" : loginShell || "/bin/sh");

/** A Unix login shell loads its start-up files for `-l`; the Windows command shell takes no such flag. */
export const shellArgsOf = (platform: NodeJS.Platform): string[] => (platform === "win32" ? [] : ["-l"]);

/** A folder made if missing and returned by its real path, which the sandbox's paths match. */
const madeRealFolder = (folder: string, mode = 0o700) => {
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
export interface TerminalHost {
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
  /** Where a paired device's shell keeps temporary files, inside the fence. */
  readonly tempRoot: string;
  /** Which executable a name names, for finding the Linux sandbox; the shell's own `which` when left out. */
  readonly which?: (name: string) => string | null;
}

interface Session {
  readonly cwd: string;
  isRunning: boolean;
  output: string;
  readonly process: IPty;
  sequence: number;
}

/** The host service's conversation shells, one per conversation and scope, whose output announces to every screen. */
export class ConversationTerminals {
  private readonly sessions = new Map<string, Session>();
  private readonly platform: NodeJS.Platform;
  private readonly shell: string;

  constructor(
    private readonly host: TerminalHost,
    /** Sends one frame to every connected screen: the host's window and each paired device. */
    private readonly broadcast: (frame: ServerFrame) => void,
  ) {
    this.platform = host.platform ?? process.platform;
    this.shell =
      host.shell ?? defaultShellOf(this.platform, userInfo().shell || process.env.SHELL, process.env.ComSpec);
  }

  /** The scope's full session key, as every frame that announces the shell to a screen names it. */
  static keyOf(scope: TerminalScope, id: string) {
    return `${scope}:${id}`;
  }

  /** Starts the conversation's shell, or returns its retained output without restarting its process. */
  open(scope: "host" | "remote", id: string, cwd: string | null) {
    if (typeof id !== "string" || id.length === 0 || id.length > 4096)
      throw new TerminalFailure("InvalidInput", "Invalid terminal identifier.");
    if (cwd !== null && (typeof cwd !== "string" || !isAbsolute(cwd)))
      throw new TerminalFailure("InvalidInput", "Choose an absolute realm folder.");
    if (scope === "remote" && this.host.sandbox === null) throw sandboxMissing();
    const key = ConversationTerminals.keyOf(scope, id);
    const existing = this.sessions.get(key);
    if (existing !== undefined) return this.view(existing);
    let count = 0;
    for (const sessionKey of this.sessions.keys()) if (sessionKey.startsWith(`${scope}:`)) count++;
    if (count >= sessionsPerScope)
      throw new TerminalFailure("InvalidInput", "Close an existing terminal before opening another.");
    const start = cwd ?? this.host.home;
    if (!existsSync(start)) throw new TerminalFailure("InvalidInput", "The terminal's starting folder does not exist.");
    const folder = realpathSync(start);
    if (!statSync(folder).isDirectory())
      throw new TerminalFailure("InvalidInput", "The terminal's starting folder is not a directory.");
    prepareTerminalHelper();
    const started =
      scope === "remote"
        ? this.wrappedShell(folder)
        : { args: shellArgsOf(this.platform), command: this.shell, env: this.environment() };
    const shell = spawn(started.command, started.args, {
      cols: 80,
      cwd: folder,
      env: started.env,
      name: "xterm-256color",
      rows: 24,
    });
    const session: Session = { cwd: folder, isRunning: true, output: "", process: shell, sequence: 0 };
    this.sessions.set(key, session);
    shell.onData((data) => {
      session.output = (session.output + data).slice(-outputLimit);
      session.sequence++;
      if (this.sessions.get(key) === session)
        this.broadcast({ _tag: "TerminalData", data, id: key, sequence: session.sequence });
    });
    shell.onExit(() => {
      session.isRunning = false;
      if (this.sessions.get(key) === session) this.broadcast({ _tag: "TerminalExit", id: key });
    });
    return this.view(session);
  }

  /** A paired device's shell, inside the OS sandbox, writing only in its folder and the terminals' temporary folder. */
  private wrappedShell(folder: string) {
    if (this.host.sandbox === null) throw sandboxMissing();
    const wrapped = wrappedFencedCommandOf(
      this.host.sandbox,
      [folder, madeRealFolder(this.host.tempRoot)],
      this.shell,
      shellArgsOf(this.platform),
    );
    return { args: wrapped.args, command: wrapped.command, env: this.remoteEnvironment() };
  }

  /** The environment a paired device's shell starts with: the service's own, without its loopback token. */
  private remoteEnvironment() {
    const env: NodeJS.ProcessEnv = { ...this.environment(), TMPDIR: this.host.tempRoot };
    delete env.OUTLORE_TOKEN;
    return env;
  }

  private environment() {
    return this.host.environment ?? process.env;
  }

  private view(session: Session) {
    return { cwd: session.cwd, isRunning: session.isRunning, output: session.output, sequence: session.sequence };
  }

  /** Sends the owner's input to the shell, including control characters. */
  write(scope: TerminalScope, id: string, data: string) {
    if (typeof data !== "string" || data.length > 1000000)
      throw new TerminalFailure("InvalidInput", "Terminal input is too large.");
    const session = this.sessions.get(ConversationTerminals.keyOf(scope, id));
    if (session?.isRunning !== true)
      throw new TerminalFailure("InvalidInput", "The shell has exited. Start a new shell.");
    session.process.write(data);
  }

  /** Keeps the pseudo-terminal's dimensions aligned with its visible surface. */
  resize(scope: TerminalScope, id: string, cols: number, rows: number) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || cols > 500 || rows < 1 || rows > 200)
      throw new TerminalFailure("InvalidInput", "Invalid terminal dimensions.");
    const session = this.sessions.get(ConversationTerminals.keyOf(scope, id));
    if (session?.isRunning === true) session.process.resize(cols, rows);
  }

  /** Ends the shell and discards its temporary replay buffer. */
  close(scope: TerminalScope, id: string) {
    const key = ConversationTerminals.keyOf(scope, id);
    const session = this.sessions.get(key);
    this.sessions.delete(key);
    if (session?.isRunning === true) session.process.kill();
  }

  /** Ends every shell when the host stops (ADR 0020: no terminal outlives the host). */
  dispose() {
    const sessions = [...this.sessions.values()];
    this.sessions.clear();
    for (const session of sessions) if (session.isRunning) session.process.kill();
  }
}

// The host's own ways, and the requests the screens make.

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

/** The service the request handlers reach the conversation shells through. */
export class Terminals extends Context.Service<Terminals, ConversationTerminals>()("outlore/Terminals") {}

/** The host's conversation shells, in their own layer so each shell ends when the layer closes (ADR 0020). */
export const terminalsLayer = (host: TerminalHost) =>
  Layer.effect(
    Terminals,
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const terminals = new ConversationTerminals(host, sessions.broadcast);
      yield* Effect.addFinalizer(() => Effect.sync(() => terminals.dispose()));
      return terminals;
    }),
  ).pipe(Layer.provide(sessionsLayer));

/** A terminal that refused its work, as the request's answer tells it. */
const failureOf = (error: unknown) =>
  new ServiceFailure({
    kind: error instanceof TerminalFailure ? error.kind : "ExecutionFailure",
    message: error instanceof Error ? error.message : "The terminal failed unexpectedly.",
  });

/** Runs one of the terminal's throwing ways as a request's answer. */
const runTerminal = <A>(work: () => A): Effect.Effect<A, ServiceFailure> => Effect.try({ catch: failureOf, try: work });

/**
 * Opens the conversation's shell, once a paired device asks and its owner allows: the host's own window opens the full
 * login shell, a paired device's shell only while the "Allow terminals from paired devices" switch is on
 * (conversation-terminal, ADR 0020).
 */
export const openConversationTerminal = Effect.fnUntraced(function* (
  terminals: ConversationTerminals,
  giveaway: { readonly cwd: string | null; readonly id: string },
  scope: TerminalScope,
) {
  if (scope === "remote") {
    const settings = yield* readSettings;
    if (!settings.shouldAllowRemoteTerminals)
      return yield* new ServiceFailure({
        kind: "AccessRefused",
        message: "Terminals from paired devices are off. Turn them on in this host's Workshop.",
      });
  }
  return yield* runTerminal(() => terminals.open(scope, giveaway.id, giveaway.cwd));
});

/** The terminal requests every screen of the host makes, for the service's one request table. */
export const terminalHandlers = (terminals: ConversationTerminals, scope: TerminalScope) => ({
  CloseTerminal: (given: { readonly id: string }) => runTerminal(() => terminals.close(scope, given.id)),
  OpenTerminal: (given: { readonly cwd: string | null; readonly id: string }) =>
    openConversationTerminal(terminals, given, scope),
  ResizeTerminal: (given: { readonly cols: number; readonly id: string; readonly rows: number }) =>
    runTerminal(() => terminals.resize(scope, given.id, given.cols, given.rows)),
  WriteTerminalInput: (given: { readonly data: string; readonly id: string }) =>
    runTerminal(() => terminals.write(scope, given.id, given.data)),
});
