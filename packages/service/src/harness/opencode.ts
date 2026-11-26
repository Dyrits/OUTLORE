import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffortChoice } from "@outlore/contracts";
import { type Duration, Effect } from "effect";
import {
  type Containment,
  fieldOf,
  type HarnessAdapter,
  invalid,
  reducedEnvironmentOf,
  startRpcProcess,
  type ThreadAccess,
  type TurnRequest,
  textFieldOf,
} from "../core/index.ts";
import { type AcpDialect, type AcpLaunch, makeAcpHarness } from "./acpHarness.ts";
import { noTimeLimit } from "./claudeArgs.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import { makeOpenCodeLauncher } from "./openCodeLaunch.ts";
import { readOpenCodePlanLimits } from "./openCodePlanLimits.ts";
import { editedPathsOf, findFirstOutside, promptOf } from "./openCodePrompts.ts";
import { type OpenCodeSandbox, writeOwnerMarker } from "./openCodeSandbox.ts";
import { sweepOrphans } from "./processTree.ts";
import { toolServerName } from "./toolNames.ts";
import { readOpenCodeVaultDenial } from "./vaultDenials.ts";

// OpenCode through the Agent Client Protocol (ADR 0008; `opencode acp` of OpenCode 2.2.0, probed 2026-11-07):
// one process per thread, one ACP session per Outlore thread. The protocol is acpHarness.ts's; this file is what OpenCode
// does differently: its sandboxed launch (openCodeLaunch.ts), its configuration, its refusals, and its effort levels.

/**
 * The session option holding the model's effort levels (ACP category `thought_level`, id `effort` in OpenCode 2.2.0),
 * with the levels it offers for the session's current model, without "default"; null when the model has none.
 */
const effortOptionOf = (configOptions: unknown): { id: string; levels: Array<EffortChoice> } | null => {
  if (!Array.isArray(configOptions)) return null;
  const option = configOptions.find((candidate) => textFieldOf(candidate, "category") === "thought_level");
  const id = textFieldOf(option, "id");
  const values = fieldOf(option, "options");
  if (id === null || !Array.isArray(values)) return null;
  return {
    id,
    levels: values.flatMap((value): Array<EffortChoice> => {
      const level = textFieldOf(value, "value");
      return level === null || level === "default" ? [] : [level];
    }),
  };
};

/**
 * The effort levels OpenCode offers for one model: it says them only for a session's current model, so a short-lived
 * ACP session is opened, given the model, and asked, once more when that fails. Empty when OpenCode says the model has
 * none; a failure, which is not an empty answer, when OpenCode could not be asked (timeout, no session).
 */
export const listOpenCodeEfforts = Effect.fnUntraced(
  function* (command: string, configDirectory: string | null, model: string, prefixArgs: ReadonlyArray<string> = []) {
    const rpc = yield* startRpcProcess({
      args: [...prefixArgs, "acp"],
      command,
      cwd: tmpdir(),
      env: reducedEnvironmentOf(accountEnvironmentOf("opencode", configDirectory)),
      isJsonRpc2: true,
      label: "OpenCode",
    });
    return yield* Effect.gen(function* () {
      yield* rpc.request("initialize", {
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        protocolVersion: 1,
      });
      const created = yield* rpc.request("session/new", { cwd: tmpdir(), mcpServers: [] });
      const sessionId = textFieldOf(created, "sessionId");
      if (sessionId === null) return yield* Effect.fail(invalid("OpenCode opened no session."));
      const chosen =
        model === "default"
          ? created
          : yield* rpc.request("session/set_config_option", { configId: "model", sessionId, value: model });
      return effortOptionOf(fieldOf(chosen, "configOptions"))?.levels ?? [];
    }).pipe(Effect.timeout("30 seconds"), Effect.ensuring(Effect.sync(() => rpc.close())));
  },
  Effect.retry({ times: 1 }),
  Effect.catch(() => Effect.fail(invalid("OpenCode did not give this model's effort levels. Try again."))),
);

/** How the OpenCode adapter starts its harness. */
export type OpenCodeOptions = {
  /** The executable; `opencode` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Where each thread's starting context is written for OpenCode to read as instructions; the system's temporary folder by default. */
  readonly instructionsFolder?: string;
  /** Arguments placed before `acp`, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /**
   * The host's sandbox each thread's `opencode acp` runs in (openCodeSandbox.ts), or null when none can run here:
   * then every action OpenCode asks about asks the owner.
   */
  readonly sandbox: OpenCodeSandbox | null;
};

/**
 * OpenCode's permissions (CHG-0031, CHG-0208). Every command and edit asks Outlore. Wrapped in the host's sandbox, a
 * command runs unasked at the default level; with no sandbox, it asks the owner. An edit inside the thread's folder runs
 * unasked unless the level is "Also commands and edits", as the service decides. Its own subagents stay off: threads open
 * threads with open_thread (ADR 0007).
 */
const permissions = [
  { action: "shell", effect: "ask", resource: "*" },
  { action: "edit", effect: "ask", resource: "*" },
  { action: "subagent", effect: "deny", resource: "*" },
];

/** The configuration OpenCode adds to the owner's own: Outlore's tools, permissions, and starting context. */
const configOf = (access: ThreadAccess, instructionsPath: string) => ({
  instructions: [instructionsPath],
  mcp: {
    servers: {
      [toolServerName]: {
        timeout: { catalog: 30_000, execution: noTimeLimit, startup: 30_000 },
        type: "remote",
        url: access.mcpUrl,
      },
    },
  },
  permissions,
});

/** The line a thread shows when OpenCode, now in its sandbox, could not pick up the thread's earlier session. */
const lostSessionNote =
  "OpenCode could not pick up this thread's earlier conversation: it was saved in OpenCode's own folder, which " +
  "OpenCode cannot read now that it runs in Outlore's sandbox. The thread carries on in a new OpenCode conversation, " +
  "which was given the thread's handover notes: its conversation so far, as when a thread changes harness.";

/**
 * OpenCode's dialect of the ACP module (acpHarness.ts); everything else it does is the module's.
 * - It is launched in the host's sandbox, with the starting context in a file and the tool server in its configuration, so its session is given neither.
 * - It cancels its whole prompt when a permission is refused, so the module tells it the refusals in a new prompt of the turn.
 * - Every permission is judged by where the action runs: an edit naming no file, an executor not seen inside the sandbox, or a thread allowed to run without the sandbox asks as an escape.
 * - A session it cannot load is replaced only when sandboxed, which hides the sessions made before the sandbox; unsandboxed, the turn fails.
 * - Its effort levels exist only for the model chosen, so the model and the effort are set without being listed first.
 * - Its context is the token total of the last prompt, and its tool calls do not show as events of their own.
 */
const openCodeDialectOf = (options: OpenCodeOptions): AcpDialect => {
  const instructionsFolder = options.instructionsFolder ?? join(tmpdir(), "outlore-opencode");
  const launch = makeOpenCodeLauncher(options);

  /** The starting context and approval rules, as the file OpenCode reads them from. */
  const writeInstructions = (request: TurnRequest) =>
    Effect.sync(() => {
      mkdirSync(instructionsFolder, { recursive: true });
      const path = join(instructionsFolder, `${request.threadId}.md`);
      writeFileSync(path, `${request.context}\n\n${approvalInstructionsOf(request.access, "opencode")}\n`);
      return path;
    });

  return {
    canResumeSessions: false,
    fileEdits: "opencode",
    isContextFromUsage: true,
    label: "OpenCode",
    launchOf: Effect.fnUntraced(function* (request: TurnRequest) {
      const instructionsPath = yield* writeInstructions(request);
      const plan = yield* launch(request, JSON.stringify(configOf(request.access, instructionsPath)));
      return {
        args: plan.args,
        command: plan.command,
        containment: {
          isSandboxed: plan.isSandboxed,
          isUnconfirmed: plan.isContainmentUnconfirmed,
          isUnsandboxed: plan.isUnsandboxed,
        },
        env: plan.env,
        ...(plan.onEnded === undefined ? {} : { onEnded: plan.onEnded }),
      } satisfies AcpLaunch;
    }),
    lostSessionNote,
    mayReplaceLostSession: (started) => started.containment?.isSandboxed === true,
    promptOf: Effect.fnUntraced(function* ({ launch: started, request, rpc, toolCall }) {
      // Every permission request goes to the service, which decides from where the action runs (an edit inside the thread's
      // folder or one of its workspace's worktrees at the default level runs, leaving a line) and records it.
      // Nothing runs unasked on an assumption: the executor must be seen below the wrapped process, or it asks.
      const isUnconfirmed = started.containment?.isUnconfirmed(rpc) ?? false;
      // An edit naming no file is judged as leaving the folder: its title is no path to trust.
      const isPathless = textFieldOf(toolCall, "kind") === "edit" && editedPathsOf(toolCall).length === 0;
      return {
        ...promptOf(toolCall, yield* findFirstOutside(request, toolCall)),
        ...(isUnconfirmed || isPathless ? { isOutsideSandbox: true } : {}),
        ...(started.containment?.isUnsandboxed === true ? { isUnsandboxed: true } : {}),
      };
    }),
    questionIdPrefix: null,
    setsOptions: "always",
    shouldAnnounceToolCalls: false,
    shouldRepromptRefusals: true,
    toolServer: "launch",
    usage: "perPrompt",
  };
};

/**
 * Runs each thread in one long-lived `opencode acp` process, closed with the scope that made it. Wrapped, it first ends
 * the sandboxed OpenCode processes an earlier run of the service lost (processTree.ts sweepOrphans).
 */
export const makeOpenCodeHarness = (options: OpenCodeOptions) =>
  Effect.map(
    Effect.andThen(
      Effect.promise(async () =>
        options.sandbox === null ? [] : await sweepOrphans(writeOwnerMarker(options.sandbox)),
      ).pipe(
        Effect.flatMap((left) =>
          left.length > 0 ? Effect.logError(`OpenCode: lost processes still running: ${left.join(", ")}`) : Effect.void,
        ),
      ),
      makeAcpHarness({
        command: options.command,
        dialect: openCodeDialectOf(options),
        idleTimeout: options.idleTimeout,
        ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
      }),
    ),
    (adapter) =>
      ({
        ...adapter,
        containmentOf: (): Containment => (options.sandbox === null ? "Unprotected" : "Sandboxed"),
        readPlanLimits: (_harness, configDirectory) => readOpenCodePlanLimits(options, configDirectory),
        readVaultDenial: (harness, folder) => readOpenCodeVaultDenial(options, harness, folder),
      }) satisfies HarnessAdapter,
  );
