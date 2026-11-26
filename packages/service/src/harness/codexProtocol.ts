import { tmpdir } from "node:os";
import type { BillingKind, EffortChoice, TokenUsage } from "@outlore/contracts";
import { type Duration, Effect } from "effect";
import {
  fieldOf,
  HarnessFailure,
  type ImageAttachment,
  numberFieldOf,
  type PlanLimitsReport,
  type RpcProcess,
  reducedEnvironmentOf,
  startRpcProcess,
  type ThreadAccess,
  type TurnRequest,
  textFieldOf,
} from "../core/index.ts";
import { noTimeLimit } from "./claudeArgs.ts";
import { type GitGrants, gitGrantsOf } from "./codexGitGrants.ts";
import { vaultProfileName } from "./codexVaultProfile.ts";
import { accountEnvironmentOf } from "./harnessCatalog.ts";
import type { HarnessConnection } from "./harnessProcesses.ts";
import { approvalInstructionsOf } from "./instructions.ts";
import { toolServerName } from "./toolNames.ts";

// Codex app-server settings, usage parsing, billing, and plan-limit reads (ADR 0008; protocol of codex-cli 0.160.1, probed 2026-11-07).

/** How the Codex adapter starts its harness. */
export type CodexOptions = {
  /** The executable; `codex` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the app server's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** The Vault's folder, hidden from the sandbox by a permission profile (ADR 0022); `workspace-write` when left out and outside a Git repository. */
  readonly vaultFolder?: string;
};

/** One live `codex app-server` connection owned by a pooled thread. */
export interface CodexConnection extends HarnessConnection {
  /** How the account is billed, from Codex's own `account/read` at start; Unknown when it did not say. */
  readonly billing: BillingKind;
  readonly rpc: RpcProcess;
  /** Codex's id of the running turn, once Codex started it; null between turns. */
  turnId: string | null;
}

/** What the named profile holds for a thread: the Vault's folder to hide and the Git grants for its repository. */
export type CodexProfile = { readonly grants: GitGrants; readonly vaultFolder: string | null };

/** The longest wait Codex accepts for a thread tool, in seconds: a question waits with no time limit. */
const noTimeLimitSeconds = Math.floor(noTimeLimit / 1000);

/** Codex's own effort names; Outlore's match them, and default leaves the model's own. */
export const effortOf = (effort: EffortChoice) => (effort === "default" ? null : effort);

/**
 * How Codex asks, by approval level (CHG-0031, CHG-0208).
 * Commands always run in Codex's own workspace sandbox, never its full-access mode.
 * At the default level they ask only to leave it, and every such request asks the owner with the exact command.
 * At "Also commands and edits" every command it does not trust asks.
 */
const policyOf = (access: ThreadAccess, profile: CodexProfile | null) => ({
  approvalPolicy: access.approvalLevel === "RiskyOnly" ? "on-request" : "untrusted",
  // With a Vault folder to hide or a Git repository to commit in, the named profile keeps `workspace-write`'s rules, denies reading the folder, and lets Git write its folder except its hooks and config (codexVaultProfile.ts); the two cannot be combined in a request.
  ...(profile === null ? { sandbox: "workspace-write" } : { permissions: vaultProfileName }),
});

/** The thread's profile; null when there is neither a folder to hide nor a repository, so `workspace-write` serves. */
export const profileOf = (cwd: string, vaultFolder: string | null): CodexProfile | null => {
  const grants = gitGrantsOf(cwd);
  return vaultFolder === null && Object.keys(grants).length === 0 ? null : { grants, vaultFolder };
};

/** A turn's input: the text, then one `localImage` item per image, by the stored path (message-attachments). */
export const inputOf = (text: string, images: ReadonlyArray<ImageAttachment>) => [
  { text, text_elements: [], type: "text" },
  ...images.map((image) => ({ path: image.path, type: "localImage" })),
];

/** The thread's settings: its tools at its own endpoint, no native subagents, and Outlore's context. */
export const threadSettingsOf = (request: TurnRequest, cwd: string, profile: CodexProfile | null) => ({
  ...policyOf(request.access, profile),
  config: {
    // One thread is one Codex conversation; threads open threads with open_thread instead (ADR 0007).
    "features.multi_agent": false,
    [`mcp_servers.${toolServerName}.tool_timeout_sec`]: noTimeLimitSeconds,
    [`mcp_servers.${toolServerName}.url`]: request.access.mcpUrl,
    // The starting context already holds the folder's own instructions (workspaces.ts).
    project_doc_max_bytes: 0,
    // The sandbox contains file and process damage, not data: its network is open, so a command can reach any host (verified with command/exec on Codex 0.167.2, 2026-11-12); the Vault profile opens it the same way.
    "sandbox_workspace_write.network_access": true,
  },
  cwd,
  developerInstructions: `${request.context}\n\n${approvalInstructionsOf(request.access, "codex")}`,
  ...(request.model === "default" ? {} : { model: request.model }),
});

/** A turn's usage from Codex's per-call counts, whose input includes the cached part. */
export const usageOf = (calls: ReadonlyArray<unknown>): TokenUsage | null => {
  if (calls.length === 0) return null;
  const sum = (key: string) => calls.reduce<number>((total, call) => total + numberFieldOf(call, key), 0);
  return {
    cacheCreation: sum("cacheWriteInputTokens"),
    cacheRead: sum("cachedInputTokens"),
    input: Math.max(0, sum("inputTokens") - sum("cachedInputTokens") - sum("cacheWriteInputTokens")),
    output: sum("outputTokens"),
  };
};

/** The context window Codex reports beside a token count (`tokenUsage.modelContextWindow` in Codex 0.169.0), or null. */
export const contextWindowOf = (tokenUsage: unknown): number | null => {
  const window = numberFieldOf(tokenUsage, "modelContextWindow");
  return window > 0 ? window : null;
};

/** What the thread's context held after the latest call, whose input includes the cached part. */
export const contextOf = (calls: ReadonlyArray<unknown>): number | null => {
  const last = calls.at(-1);
  return last === undefined ? null : numberFieldOf(last, "inputTokens") + numberFieldOf(last, "outputTokens");
};

/**
 * How Codex's account is billed, from its own `account/read`: a ChatGPT sign-in is a subscription and an API key is an API key.
 * A server that does not answer in a few seconds, or answers otherwise, says Unknown (probe of 2026-11-11, Codex 0.167).
 */
export const billingOf = (rpc: RpcProcess): Effect.Effect<BillingKind> =>
  rpc.request("account/read", { refreshToken: false }).pipe(
    Effect.timeout("5 seconds"),
    Effect.map((result): BillingKind => {
      const type = textFieldOf(fieldOf(result, "account"), "type");
      return type === "chatgpt" ? "Subscription" : type === "apiKey" ? "ApiKey" : "Unknown";
    }),
    Effect.catch(() => Effect.succeed<BillingKind>("Unknown")),
  );

/** A window of Codex's rate limits as reported, or none when it carries no use. */
const windowOf = (window: unknown) =>
  typeof fieldOf(window, "usedPercent") === "number" && typeof fieldOf(window, "windowDurationMins") === "number"
    ? [
        {
          resetsAtSeconds: numberFieldOf(window, "resetsAt"),
          usedPercent: numberFieldOf(window, "usedPercent"),
          windowMinutes: numberFieldOf(window, "windowDurationMins"),
        },
      ]
    : [];

/**
 * The limits of the plan behind an account, asked of a short `codex app-server` run in the account's own folder (`account/rateLimits/read`, probe of 2026-11-11).
 * An API key has no plan limits; null when Codex cannot answer, and no token is read here.
 */
export const readCodexPlanLimits = Effect.fnUntraced(function* (options: CodexOptions, configDirectory: string | null) {
  const rpc = yield* startRpcProcess({
    args: [...(options.prefixArgs ?? []), "app-server"],
    command: options.command,
    cwd: tmpdir(),
    env: reducedEnvironmentOf(accountEnvironmentOf("codex", configDirectory)),
    isJsonRpc2: false,
    label: "Codex",
  });
  return yield* Effect.gen(function* () {
    yield* rpc.request("initialize", {
      capabilities: { experimentalApi: true, requestAttestation: false },
      clientInfo: { name: "outlore", title: "Outlore", version: "0.0.0" },
    });
    rpc.notify("initialized", {});
    const billing = yield* billingOf(rpc);
    if (billing === "ApiKey") return { billing, windows: [] } satisfies PlanLimitsReport;
    const limits = fieldOf(yield* rpc.request("account/rateLimits/read", {}), "rateLimits");
    return {
      billing,
      windows: [...windowOf(fieldOf(limits, "primary")), ...windowOf(fieldOf(limits, "secondary"))],
    } satisfies PlanLimitsReport;
  }).pipe(
    Effect.timeout("15 seconds"),
    Effect.mapError((error) => new HarnessFailure({ reason: `Codex gave no plan limits: ${String(error)}` })),
    Effect.ensuring(Effect.sync(() => rpc.close())),
  );
});
