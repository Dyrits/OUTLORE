import type { ApprovalLevel, HarnessName } from "@outlore/contracts";
import { type Duration, Effect, Layer } from "effect";
import {
  type Containment,
  fieldOf,
  Harness,
  type HarnessAdapter,
  type PlanLimitsReport,
  reducedEnvironmentOf,
  startStreamJsonProcess,
  type TurnRequest,
  textFieldOf,
} from "../core/index.ts";
import { type AccessOptions, accessArgsOf, baseArgsOf, isSandboxedOf, noTimeLimit } from "./claudeArgs.ts";
import { probeClaudePlanLimits } from "./claudePlanLimits.ts";
import { type ClaudeConnection, claudeMessageContentOf, runClaudeTurn } from "./claudeTurn.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import {
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
  type ProcessSignals,
} from "./harnessProcesses.ts";
import { resolvedFolderOf, resolveStartFolder } from "./threadFolder.ts";
import { readClaudeVaultDenial, runClaudeVaultDenialLive } from "./vaultDenials.ts";
import { listThreadWorktrees } from "./worktrees.ts";

// Claude Code through `claude -p` in stream-json mode (ADR 0008; CHG-0027): one process per thread.

export { planLimitsOf } from "./claudePlanLimits.ts";

/** How the Claude Code adapter starts its harness. */
export type ClaudeOptions = AccessOptions & {
  /** The executable; `claude` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Claude Code's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/** The child's environment, signed in with the turn's account (provider-accounts). */
const childEnvironment = (configDirectory: string | null) =>
  reducedEnvironmentOf({ ...accountEnvironmentOf("claude", configDirectory), MCP_TOOL_TIMEOUT: String(noTimeLimit) });

/** Claude Code's protocol: a user message per turn, read until its result. */
const claudeProtocolOf = (
  options: ClaudeOptions,
  reports: Map<string, PlanLimitsReport>,
): HarnessProtocol<ClaudeConnection> => ({
  interrupt: (connection) =>
    Effect.sync(() => {
      connection.process.write({
        request: { subtype: "interrupt" },
        request_id: crypto.randomUUID(),
        type: "control_request",
      });
      return true;
    }),

  // A changed level, set of permissions, set of workspace instructions, model, effort, folder, or account restarts the process, resuming its conversation; the journal and lore ride on the turn's message instead.
  restartKeyOf: (request) =>
    JSON.stringify([
      accessArgsOf(request.access, request.context, options, listThreadWorktrees(request)),
      // The tools are listed when the process starts, so a change of Code Mode restarts it.
      request.access.usesCodeMode,
      // So are the connector tools it may run unasked and lists (connectors blueprint, Open: tool listing at a turn's start).
      request.access.connectorTools,
      request.configDirectory,
      request.cwd,
      // Where the folder really points: a link pointed elsewhere restarts the process, whose start checks it again.
      resolvedFolderOf(request.cwd),
      request.effort,
      request.model,
    ]),

  runTurn: (connection: ClaudeConnection, request: TurnRequest, turn: PooledTurn) =>
    runClaudeTurn(connection, request, turn, reports),

  start: Effect.fnUntraced(function* (request: TurnRequest, signals: ProcessSignals) {
    // A thread folder that is a link asks the owner; allowed, Claude Code starts where it really points, under its own sandbox, which then writes there (threadFolder.ts).
    const cwd = yield* resolveStartFolder(request, "Claude Code");
    const isResuming = request.sessionId !== null;
    const sessionId = request.sessionId ?? crypto.randomUUID();
    const background = { hasBackgroundWake: false, tasks: 0 };
    const process = yield* startStreamJsonProcess({
      args: [
        ...(options.prefixArgs ?? []),
        ...baseArgsOf(request.access.unaskedTools),
        ...accessArgsOf(request.access, request.context, options, listThreadWorktrees(request)),
        ...(isResuming ? ["--resume", sessionId] : ["--session-id", sessionId]),
        ...(request.model === "default" ? [] : ["--model", request.model]),
        ...(request.effort === "default" ? [] : ["--effort", request.effort]),
      ],
      command: options.command,
      cwd,
      // The folder it was started in, as a shell it starts takes it.
      env: { ...childEnvironment(request.configDirectory), PWD: cwd },
      label: "Claude Code",
      // Between turns nothing reads the process: a background task ending wakes Claude Code, which then works on its own, and the pool asks for a turn so that work is recorded and its commands may run.
      observe: (message) => {
        if (textFieldOf(message, "type") !== "system") return;
        const subtype = textFieldOf(message, "subtype");
        if (subtype === "background_tasks_changed") {
          const tasks = fieldOf(message, "tasks");
          background.tasks = Array.isArray(tasks) ? tasks.length : 0;
        } else if (subtype === "task_notification") {
          background.hasBackgroundWake = true;
          signals.resume();
        }
      },
    });
    return {
      background,
      billing: "Unknown",
      close: process.close,
      hasBackgroundWake: () => background.hasBackgroundWake,
      hasBackgroundWork: () => background.tasks > 0,
      hasExited: process.hasExited,
      lastTotalCost: 0,
      process,
      sessionId,
    } satisfies ClaudeConnection;
  }),

  // A user message written mid-turn joins it after the current tool call; its uuid comes back in the echo once taken in (probe of 2026-11-06, Claude Code 2.1.302).
  steer: (connection, message) =>
    claudeMessageContentOf(message.text, message.images).pipe(
      Effect.map((content) => {
        connection.process.write({ message: { content, role: "user" }, type: "user", uuid: message.id });
        return true;
      }),
      Effect.catch(() => Effect.succeed(false)),
    ),
});

/**
 * The Claude Code adapter, whose processes close with the scope that made it.
 * Its plan limits come from the `rate_limit_event` of the account's latest turn; an account with none yet is probed once per run.
 */
export const makeClaudeHarness = Effect.fnUntraced(function* (options: ClaudeOptions) {
  const reports = new Map<string, PlanLimitsReport>();
  const probed = new Set<string>();
  const adapter = yield* makeHarnessProcesses(claudeProtocolOf(options, reports), options);
  const readPlanLimits = (_harness: unknown, configDirectory: string | null) => {
    const key = configDirectory ?? "";
    const known = reports.get(key);
    if (known !== undefined) return Effect.succeed<PlanLimitsReport | null>(known);
    if (probed.has(key)) return Effect.succeed<PlanLimitsReport | null>(null);
    probed.add(key);
    return probeClaudePlanLimits(options, configDirectory).pipe(
      Effect.tap((report) => Effect.sync(() => report !== null && reports.set(key, report))),
      // A failed probe is tried again after the caller's wait.
      Effect.tapError(() => Effect.sync(() => probed.delete(key))),
    );
  };
  // Claude Code runs its commands in its own sandbox at the default level, unless the host cannot start one (core/sandbox.ts); at "Also commands and edits" it runs without it, and every prompt asks as for an unprotected harness.
  const containmentOf = (_harness: unknown, level: ApprovalLevel): Containment =>
    isSandboxedOf(level, options) ? "Sandboxed" : "Unprotected";
  const readVaultDenial = (harness: HarnessName, folder: string) => readClaudeVaultDenial(options, harness, folder);
  const runVaultDenialLive = (harness: HarnessName, folder: string) =>
    runClaudeVaultDenialLive(options, harness, folder);
  return { ...adapter, containmentOf, readPlanLimits, readVaultDenial, runVaultDenialLive } satisfies HarnessAdapter;
});

/** Runs each thread in one long-lived `claude -p` stream-json process (CHG-0027). */
export const claudeHarnessLayer = (options: ClaudeOptions) => Layer.effect(Harness, makeClaudeHarness(options));
