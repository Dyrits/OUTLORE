import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { HarnessFailure, type RpcProcess, startRpcProcess } from "../core/index.ts";
import { acpAgentVersionOf, acpVersionAtLeast } from "./acpSession.ts";

// Shared launch hygiene for every ACP harness process: an optional per-launch temporary directory removed when the
// process ends or fails to start, and a declarative minimum agent version check against `initialize`.

/**
 * The process a thread's session runs in: its arguments and its complete environment.
 * A launch that wraps the executable in a sandbox names the command to start, and then its arguments are complete.
 */
export type AcpLaunch = {
  readonly args: ReadonlyArray<string>;
  /** The executable to start, when the launch wraps it; otherwise the harness's own command, after the harness's prefix arguments. */
  readonly command?: string;
  readonly env: Record<string, string | undefined>;
  /** How the launch contains the process, for a dialect that judges permissions by it (`promptOf`). */
  readonly containment?: {
    /** Whether the executor, the process that runs the agent's commands and edits, is NOT confirmed to be inside the sandbox; read at each permission request. */
    readonly isUnconfirmed: (rpc: RpcProcess) => boolean;
    /** Whether the process is wrapped in the sandbox. */
    readonly isSandboxed: boolean;
    /** Whether the owner allowed the agent to run without the sandbox it would otherwise run in. */
    readonly isUnsandboxed: boolean;
  };
  /** Ends anything the process left behind once it has ended, however it ended. */
  readonly onEnded?: () => Promise<ReadonlyArray<number>>;
};

/** Options for starting one ACP JSON-RPC process with shared launch hygiene. */
export type AcpRpcStartOptions = {
  readonly args: ReadonlyArray<string>;
  readonly command: string;
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  /** When true, creates a fresh temporary directory passed as `TMPDIR`, `TMP`, and `TEMP`, and removes it when the process ends. */
  readonly hasIsolatedTempDir?: boolean;
  readonly label: string;
  readonly onEnded?: () => Promise<ReadonlyArray<number>>;
};

/** Starts one ACP JSON-RPC child process, giving it an isolated temporary directory removed on exit when requested. */
export const startAcpRpcProcess = Effect.fnUntraced(function* (options: AcpRpcStartOptions) {
  const tempDir =
    options.hasIsolatedTempDir === true
      ? yield* Effect.sync(() => mkdtempSync(join(tmpdir(), "outlore-acp-tmp-")))
      : null;
  const removeTempDir = () => {
    if (tempDir === null) return;
    try {
      rmSync(tempDir, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    } catch {
      // Best-effort cleanup so a locked or already-removed directory never masks the process exit.
    }
  };
  const onEnded =
    tempDir === null
      ? options.onEnded
      : async (): Promise<ReadonlyArray<number>> => {
          try {
            return options.onEnded === undefined ? [] : await options.onEnded();
          } finally {
            removeTempDir();
          }
        };
  return yield* startRpcProcess({
    args: options.args,
    command: options.command,
    cwd: options.cwd,
    env: tempDir === null ? options.env : { ...options.env, TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir },
    isJsonRpc2: true,
    isTreeKilled: true,
    label: options.label,
    ...(onEnded === undefined ? {} : { onEnded }),
  }).pipe(Effect.onError(() => Effect.sync(removeTempDir)));
});

/**
 * Checks the version the agent reported in `initialize` against the dialect's minimum.
 * An absent version is left alone; a reported version below the minimum fails before a session opens.
 */
export const checkAcpAgentVersion = (
  initialized: unknown,
  minimumAgentVersion: string | undefined,
  label: string,
): Effect.Effect<void, HarnessFailure> => {
  if (minimumAgentVersion === undefined) return Effect.void;
  const reported = acpAgentVersionOf(initialized);
  if (reported === null || acpVersionAtLeast(reported, minimumAgentVersion)) return Effect.void;
  return Effect.fail(
    new HarnessFailure({
      reason: `${label} ${reported} is older than the minimum supported version (${minimumAgentVersion}). Update ${label} and try again.`,
    }),
  );
};
