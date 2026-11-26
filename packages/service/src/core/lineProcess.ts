import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Effect, Queue } from "effect";
import { killProcessTree } from "./processTree.ts";

// A child process spoken to one JSON message per line on its standard streams (ADR 0008), in one of two framings: stream-json here, and JSON-RPC in rpcProcess.ts.

/** How to start a child process. */
export type LineProcessOptions = {
  readonly args: ReadonlyArray<string>;
  readonly command: string;
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  /** Whether the process starts in its own process group and session, and closing ends that group and the process's whole tree, children that left the group included (processTree.ts). */
  readonly isTreeKilled?: boolean;
  /** The child's name as the owner reads it, for failures. */
  readonly label: string;
  /** Run once the process has ended, however it ended: ends what it left behind, such as a child that outlived it and so lost its link to the tree (sweepOrphans). */
  readonly onEnded?: () => Promise<ReadonlyArray<number>>;
  /** Called with each message the moment it is read, whether or not anything has taken it from `incoming` yet. */
  readonly observe?: (message: unknown) => void;
};

/** The environment of a child process the service starts: Outlore's own variables, and any scrubbed prefixes, left out before extras apply. */
export const reducedEnvironmentOf = (
  extra: Record<string, string>,
  scrubbedPrefixes: ReadonlyArray<string> = [],
): Record<string, string | undefined> => ({
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("OUTLORE_") && !scrubbedPrefixes.some((prefix) => key.startsWith(prefix)),
    ),
  ),
  ...extra,
});

/** What a short command printed. */
export type CommandRun = {
  /** The exit code; null when the command is missing or timed out. */
  readonly code: number | null;
  /** What the command printed on both streams; some tools print their status on standard error. */
  readonly output: string;
  readonly stdout: string;
};

/** Runs a command, by default a short one; a missing command or a timeout reads as exit code null. */
export const runShortCommand = (
  command: string,
  args: ReadonlyArray<string>,
  env: Record<string, string>,
  timeoutMillis = 20_000,
  cwd?: string,
) =>
  Effect.callback<CommandRun>((resume) => {
    execFile(
      command,
      [...args],
      { cwd, env: reducedEnvironmentOf(env), maxBuffer: 4_000_000, timeout: timeoutMillis },
      (error, stdout, stderr) => {
        const code = error === null ? 0 : typeof error.code === "number" ? error.code : null;
        resume(Effect.succeed({ code, output: `${stdout}\n${stderr}`, stdout: String(stdout) }));
      },
    );
  });

/** What the transport hands its framing: each parsed line, then once the reason the process ended. */
export type LineHandlers = {
  readonly onExit: (reason: string) => void;
  readonly onMessage: (message: unknown) => void;
};

/** Spawns the process; a line that is not JSON is skipped, and a missing executable reads as its exit. */
export const spawnLineProcess = (options: LineProcessOptions, handlers: LineHandlers) => {
  let hasExited = false;
  let stderr = "";
  const isTreeKilled = options.isTreeKilled === true;
  const child = spawn(options.command, [...options.args], {
    cwd: options.cwd,
    // Its own group, so the group can be ended as a whole; its standard streams still tie it to the service.
    detached: isTreeKilled,
    env: options.env,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const reportLeft = (left: ReadonlyArray<number>) => {
    if (left.length > 0)
      Effect.runFork(Effect.logError(`${options.label}: processes still running after close: ${left.join(", ")}`));
  };
  const end = (reason: string) => {
    if (hasExited) return;
    hasExited = true;
    handlers.onExit(reason);
    if (options.onEnded !== undefined) void options.onEnded().then(reportLeft);
  };
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2000);
  });
  if (child.stdout !== null) {
    createInterface({ input: child.stdout }).on("line", (text) => {
      let message: unknown;
      try {
        message = JSON.parse(text);
      } catch {
        return;
      }
      handlers.onMessage(message);
    });
  }
  child.on("error", (error: NodeJS.ErrnoException) =>
    end(error.code === "ENOENT" ? `${options.label} was not found at "${options.command}".` : error.message),
  );
  child.on("exit", (code, signal) =>
    end(stderr.trim() || `${options.label} stopped unexpectedly (${signal ?? `exit code ${code}`}).`),
  );
  // A write to a closed stdin is reported by the exit handler instead.
  child.stdin?.on("error", () => void 0);
  return {
    close: () => {
      // A process that already ended is left alone: its id may belong to another process by now.
      if (hasExited) return;
      // Read the tree before the root ends, then check that nothing it started is left running.
      if (isTreeKilled && child.pid !== undefined) void killProcessTree(child.pid, 2000, true).then(reportLeft);
      else child.kill();
    },
    hasExited: () => hasExited,
    pid: child.pid ?? null,
    write: (message: object) => {
      if (!hasExited) child.stdin?.write(`${JSON.stringify(message)}\n`);
    },
  };
};

/** What a stream-json process sends: one parsed message, or its end. */
export type StreamItem =
  | { readonly _tag: "Message"; readonly message: unknown }
  | { readonly _tag: "Exit"; readonly reason: string };

/** One running stream-json process. */
export interface StreamJsonProcess {
  readonly close: () => void;
  readonly hasExited: () => boolean;
  readonly incoming: Queue.Queue<StreamItem>;
  readonly write: (message: object) => void;
}

/** Starts a stream-json process that lives until `close` or until it exits on its own. */
export const startStreamJsonProcess = Effect.fnUntraced(function* (options: LineProcessOptions) {
  const incoming = yield* Queue.unbounded<StreamItem>();
  const child = spawnLineProcess(options, {
    onExit: (reason) => Queue.offerUnsafe(incoming, { _tag: "Exit", reason }),
    onMessage: (message) => {
      Queue.offerUnsafe(incoming, { _tag: "Message", message });
      options.observe?.(message);
    },
  });
  return { ...child, incoming } satisfies StreamJsonProcess;
});
