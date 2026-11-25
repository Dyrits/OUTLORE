import { existsSync, realpathSync, statSync } from "node:fs";
import { userInfo } from "node:os";
import { isAbsolute } from "node:path";
import type { ServerFrame } from "@outlore/contracts";
import { Config, Effect } from "effect";
import { type IPty, spawn } from "node-pty";
import { invalid, ServiceFailure, wrappedFencedCommandOf } from "../core/index.ts";
import {
  defaultShellOf,
  madeRealFolder,
  prepareTerminalHelper,
  shellArgsOf,
  type TerminalHost,
  type TerminalScope,
} from "./terminalHost.ts";

// The owner's conversation shells, once the desktop window's own and now the host service's (ADR 0012 amendment,
// ADR 0020): every screen reaches the same shells through the service's requests. The host's own window opens the
// owner's full login shell, as before; a paired device may open and steer one only while the owner's "Allow terminals
// from paired devices" switch is on, and its shell runs inside the OS sandbox the harnesses run in, writing only
// inside the conversation's folder. A paired device's shell is shared by every paired device, and kept apart from the
// host window's, so a screen never sees a shell its fence does not cover.

const outputLimit = 200000;
const sessionsPerScope = 32;

/** A shell as the screens see it: where it runs, whether it still runs, and the output kept for a screen that reopens it. */
export type TerminalView = {
  readonly cwd: string;
  readonly exitCode: number | null;
  readonly isRunning: boolean;
  readonly output: string;
  readonly sequence: number;
};

type Session = {
  readonly cwd: string;
  exitCode: number | null;
  isRunning: boolean;
  output: string;
  readonly process: IPty;
  sequence: number;
};

type StartedShell = { readonly args: string[]; readonly command: string; readonly env: NodeJS.ProcessEnv };

/** The host service's conversation shells, one per conversation and scope, whose output announces to every screen. */
export interface ConversationTerminals {
  /** Ends the shell and discards its temporary replay buffer. */
  readonly close: (scope: TerminalScope, id: string) => Effect.Effect<void, ServiceFailure>;
  /** Ends every shell when the host stops (ADR 0020: no terminal outlives the host). */
  readonly dispose: Effect.Effect<void>;
  /** Starts the conversation's shell, or returns its retained output without restarting its process. */
  readonly open: (scope: TerminalScope, id: string, cwd: string | null) => Effect.Effect<TerminalView, ServiceFailure>;
  /** Starts a one-shot interactive command inside a managed PTY session, replacing any previous session with the same id. */
  readonly openCommand: (
    scope: TerminalScope,
    id: string,
    options: {
      readonly command: string;
      readonly cwd?: string | null;
      readonly env?: Readonly<Record<string, string>>;
    },
  ) => Effect.Effect<TerminalView, ServiceFailure>;
  /** Keeps the pseudo-terminal's dimensions aligned with its visible surface. */
  readonly resize: (
    scope: TerminalScope,
    id: string,
    cols: number,
    rows: number,
  ) => Effect.Effect<void, ServiceFailure>;
  /** Sends the owner's input to the shell, including control characters. */
  readonly write: (scope: TerminalScope, id: string, data: string) => Effect.Effect<void, ServiceFailure>;
}

/** The scope's full session key, as every frame that announces the shell to a screen names it. */
export const terminalKeyOf = (scope: TerminalScope, id: string) => `${scope}:${id}`;

/** The shell it names a plain answer for; the sandbox's absence is the one refusal that is about the host. */
const sandboxMissing = () =>
  new ServiceFailure({
    kind: "Unsupported",
    message: "This computer offers no sandbox, so terminals from paired devices are off.",
  });

/** A platform call that failed unexpectedly, as the request's answer tells it. */
const attempt = <A>(work: () => A): Effect.Effect<A, ServiceFailure> =>
  Effect.try({
    catch: (error) =>
      new ServiceFailure({
        kind: "ExecutionFailure",
        message: error instanceof Error ? error.message : "The terminal failed unexpectedly.",
      }),
    try: work,
  });

const viewOf = (session: Session): TerminalView => ({
  cwd: session.cwd,
  exitCode: session.exitCode,
  isRunning: session.isRunning,
  output: session.output,
  sequence: session.sequence,
});

const validateTarget = Effect.fnUntraced(function* (id: string, cwd: string | null) {
  if (typeof id !== "string" || id.length === 0 || id.length > 4096)
    return yield* invalid("Invalid terminal identifier.");
  if (cwd !== null && (typeof cwd !== "string" || !isAbsolute(cwd)))
    return yield* invalid("Choose an absolute realm folder.");
});

/**
 * Makes the host's conversation shells. `broadcast` sends one frame to every connected screen: the host's window and
 * each paired device.
 */
export const makeConversationTerminals = Effect.fnUntraced(function* (
  host: TerminalHost,
  broadcast: (frame: ServerFrame) => void,
) {
  const sessions = new Map<string, Session>();
  const platform = host.platform ?? process.platform;
  const loginShell = yield* Config.String("SHELL").pipe(Config.withDefault(""));
  const comspec = yield* Config.String("ComSpec").pipe(Config.withDefault(""));
  const account = yield* attempt(() => userInfo().shell);
  const shell = host.shell ?? defaultShellOf(platform, account || loginShell || null, comspec || null);
  // Read when a shell starts, not once: the shell gets the environment the service has then.
  const environment = Effect.sync(() => host.environment ?? process.env);

  const resolveFolder = Effect.fnUntraced(function* (cwd: string | null) {
    const start = cwd ?? host.home;
    if (!(yield* attempt(() => existsSync(start))))
      return yield* invalid("The terminal's starting folder does not exist.");
    const folder = yield* attempt(() => realpathSync(start));
    if (!(yield* attempt(() => statSync(folder).isDirectory())))
      return yield* invalid("The terminal's starting folder is not a directory.");
    return folder;
  });

  /** A paired device's shell, inside the OS sandbox, writing only in its folder and the terminals' temporary folder. */
  const wrappedShell = Effect.fnUntraced(function* (folder: string) {
    if (host.sandbox === null) return yield* sandboxMissing();
    const tempRoot = yield* attempt(() => madeRealFolder(host.tempRoot));
    const wrapped = wrappedFencedCommandOf(host.sandbox, [folder, tempRoot], shell, shellArgsOf(platform));
    // The service's own environment, without its loopback token.
    const env: NodeJS.ProcessEnv = { ...(yield* environment), TMPDIR: host.tempRoot };
    delete env.OUTLORE_TOKEN;
    return { args: wrapped.args, command: wrapped.command, env } satisfies StartedShell;
  });

  const startSession = Effect.fnUntraced(function* (
    scope: TerminalScope,
    id: string,
    folder: string,
    started: StartedShell,
  ) {
    const key = terminalKeyOf(scope, id);
    const count = [...sessions.keys()].filter((sessionKey) => sessionKey.startsWith(`${scope}:`)).length;
    if (count >= sessionsPerScope) return yield* invalid("Close an existing terminal before opening another.");
    if (host.spawn === undefined) yield* attempt(prepareTerminalHelper);
    const spawner = host.spawn ?? spawn;
    const pty = yield* attempt(() =>
      spawner(started.command, started.args, {
        cols: 80,
        cwd: folder,
        env: started.env,
        name: "xterm-256color",
        rows: 24,
      }),
    );
    const session: Session = { cwd: folder, exitCode: null, isRunning: true, output: "", process: pty, sequence: 0 };
    sessions.set(key, session);
    pty.onData((data) => {
      session.output = (session.output + data).slice(-outputLimit);
      session.sequence++;
      if (sessions.get(key) === session) broadcast({ _tag: "TerminalData", data, id: key, sequence: session.sequence });
    });
    pty.onExit((event) => {
      session.isRunning = false;
      session.exitCode = event.exitCode;
      if (sessions.get(key) === session) broadcast({ _tag: "TerminalExit", exitCode: event.exitCode, id: key });
    });
    return viewOf(session);
  });

  const open: ConversationTerminals["open"] = Effect.fnUntraced(function* (scope, id, cwd) {
    yield* validateTarget(id, cwd);
    const existing = sessions.get(terminalKeyOf(scope, id));
    if (existing !== undefined) return viewOf(existing);
    if (scope === "remote" && host.sandbox === null) return yield* sandboxMissing();
    const folder = yield* resolveFolder(cwd);
    const started: StartedShell =
      scope === "remote"
        ? yield* wrappedShell(folder)
        : { args: shellArgsOf(platform), command: shell, env: yield* environment };
    return yield* startSession(scope, id, folder, started);
  });

  const close: ConversationTerminals["close"] = (scope, id) => {
    const key = terminalKeyOf(scope, id);
    const session = sessions.get(key);
    sessions.delete(key);
    return session?.isRunning === true ? attempt(() => session.process.kill()) : Effect.void;
  };

  const openCommand: ConversationTerminals["openCommand"] = Effect.fnUntraced(function* (scope, id, options) {
    const cwd = options.cwd ?? null;
    yield* validateTarget(id, cwd);
    yield* close(scope, id);
    const folder = yield* resolveFolder(cwd);
    return yield* startSession(scope, id, folder, {
      args: platform === "win32" ? ["/c", options.command] : ["-c", options.command],
      command: platform === "win32" ? shell : "/bin/sh",
      env: { ...(yield* environment), ...options.env },
    });
  });

  const write: ConversationTerminals["write"] = Effect.fnUntraced(function* (scope, id, data) {
    if (typeof data !== "string" || data.length > 1000000) return yield* invalid("Terminal input is too large.");
    const session = sessions.get(terminalKeyOf(scope, id));
    if (session?.isRunning !== true) return yield* invalid("The shell has exited. Start a new shell.");
    yield* attempt(() => session.process.write(data));
  });

  const resize: ConversationTerminals["resize"] = Effect.fnUntraced(function* (scope, id, cols, rows) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 1 || cols > 500 || rows < 1 || rows > 200)
      return yield* invalid("Invalid terminal dimensions.");
    const session = sessions.get(terminalKeyOf(scope, id));
    if (session?.isRunning === true) yield* attempt(() => session.process.resize(cols, rows));
  });

  const dispose = Effect.sync(() => {
    const ended = [...sessions.values()];
    sessions.clear();
    for (const session of ended) if (session.isRunning) session.process.kill();
  });

  return { close, dispose, open, openCommand, resize, write } satisfies ConversationTerminals;
});
