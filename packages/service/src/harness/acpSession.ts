import type { TokenUsage } from "@outlore/contracts";
import { Effect, Queue, Result } from "effect";
import type { RpcProcess, ThreadAccess } from "../core/index.ts";
import { fieldOf, numberFieldOf, type TurnRequest, textFieldOf } from "../core/index.ts";
import { acpStdioMcpServerOf } from "./acpMcpBridge.ts";
import { toolServerName } from "./toolNames.ts";

/** The initialize request: protocol version 1, no filesystem or terminal use, so an agent's own client tools for them stay off. */
export const acpInitializeParams = {
  clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
  clientInfo: { name: "outlore", title: "Outlore", version: "0.0.0" },
  protocolVersion: 1,
};

/** Identifies the settings that require a running ACP process to reload its session. */
export const acpRestartKeyOf = (request: TurnRequest) =>
  JSON.stringify([
    request.context,
    request.access,
    request.configDirectory,
    request.model,
    request.effort,
    request.cwd,
  ]);

/** Loads an ACP session and drops updates replayed from its earlier conversation. */
export const loadAcpSession = Effect.fnUntraced(function* (
  rpc: RpcProcess,
  cwd: string,
  sessionId: string,
  mcpServers: ReadonlyArray<object>,
) {
  const result = yield* rpc.request("session/load", { cwd, mcpServers, sessionId }).pipe(Effect.result);
  yield* Queue.clear(rpc.incoming);
  return result;
});

/**
 * Opens an earlier ACP session again.
 * `session/resume` comes first where the caller may use it, because `session/load` replays the session's tool calls to the client while resuming does not;
 * a resume the agent refuses falls back to the load, so a lost session surfaces as one failure for the caller's own fallback.
 * `cwd` and `mcpServers` are sent even when empty, since agents answer -32602 to a request missing either.
 */
export const reopenAcpSession = Effect.fnUntraced(function* (
  rpc: RpcProcess,
  options: {
    readonly canResume: boolean;
    readonly cwd: string;
    readonly mcpServers: ReadonlyArray<object>;
    readonly sessionId: string;
  },
) {
  if (options.canResume) {
    const resumed = yield* rpc
      .request("session/resume", { cwd: options.cwd, mcpServers: options.mcpServers, sessionId: options.sessionId })
      .pipe(Effect.result);
    if (Result.isSuccess(resumed)) {
      yield* Queue.clear(rpc.incoming);
      return resumed;
    }
  }
  return yield* loadAcpSession(rpc, options.cwd, options.sessionId, options.mcpServers);
});

/** The version the agent names in its `initialize` answer (`agentInfo.version`), or null when it names none. */
export const acpAgentVersionOf = (initialized: unknown): string | null =>
  textFieldOf(fieldOf(initialized, "agentInfo"), "version");

/**
 * Whether a version is at least a minimum, comparing the first three numbers of each (`1.5.16` is at least `1.5.0`; a missing third number is 0).
 * A version that does not start with numbers, or none, is never at least anything: a dialect that gates a behavior on the agent's version leaves it off for an agent that does not say.
 */
export const acpVersionAtLeast = (version: string | null, minimum: string): boolean => {
  const numbersOf = (text: string) => {
    const match = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/u.exec(text);
    return match === null ? null : [1, 2, 3].map((index) => Number.parseInt(match[index] ?? "0", 10));
  };
  const found = version === null ? null : numbersOf(version);
  const wanted = numbersOf(minimum);
  if (found === null || wanted === null) return false;
  for (const [index, number] of found.entries()) {
    const difference = number - (wanted[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
};

/** Finds the option ID the ACP agent offered for a one-time permission answer. */
export const permissionOptionIdOf = (params: unknown, kind: "allow_once" | "reject_once") => {
  const options = fieldOf(params, "options");
  const option = Array.isArray(options) ? options.find((candidate) => textFieldOf(candidate, "kind") === kind) : null;
  return textFieldOf(option, "optionId");
};

/** The modes a session's answer lists, by id. */
export const modeIdsOf = (modes: unknown): ReadonlyArray<string> => {
  const available = fieldOf(modes, "availableModes");
  return Array.isArray(available) ? available.flatMap((mode) => textFieldOf(mode, "id") ?? []) : [];
};

/** The config options a session's answer offers, by id. */
export const configOptionIdsOf = (configOptions: unknown): ReadonlyArray<string> =>
  Array.isArray(configOptions) ? configOptions.flatMap((option) => textFieldOf(option, "id") ?? []) : [];

/**
 * The session option that sets the thinking level, or null when the session offers none.
 * It is the option named `thinking` where the agent calls it that (Vibe), and otherwise the one of ACP category `thought_level`, whatever its id (Antigravity's `thought_level`, checked live on CLI 1.5.16, which answers -32602 "Unknown config option" to `thinking`).
 */
export const thinkingConfigIdOf = (configOptions: unknown): string | null => {
  if (!Array.isArray(configOptions)) return null;
  const named = configOptions.find((option) => textFieldOf(option, "id") === "thinking");
  const option = named ?? configOptions.find((candidate) => textFieldOf(candidate, "category") === "thought_level");
  return textFieldOf(option, "id");
};

/**
 * How a session is given the thread's tool server, as ACP `McpServer` entries; none when the thread has no tool server.
 * - `http`: always the HTTP server (ACP `HttpMcpServer`), for an agent that validates the entry and answers anything else -32602 Invalid params.
 * - `negotiated`: the HTTP server when the agent advertises `mcpCapabilities.http`, and otherwise the stdio bridge to it, since stdio is the transport ACP requires every agent to take.
 */
export const acpToolServersOf = Effect.fnUntraced(function* (
  transport: "http" | "negotiated",
  access: ThreadAccess,
  advertisesHttp: boolean,
) {
  if (access.mcpUrl === "") return [];
  if (transport === "http" || advertisesHttp)
    return [{ headers: [], name: toolServerName, type: "http", url: access.mcpUrl }];
  return [yield* acpStdioMcpServerOf(access.mcpUrl)];
});

/** The usage a prompt's answer reports (ACP `PromptResponse.usage`), thoughts counted as output; null when it reports none. */
export const acpPromptUsageOf = (usage: unknown): TokenUsage | null =>
  usage === undefined || usage === null
    ? null
    : {
        cacheCreation: numberFieldOf(usage, "cachedWriteTokens"),
        // Outlore's usage already carries cache reads beside the input, so a cached read is never added to it as well.
        cacheRead: numberFieldOf(usage, "cachedReadTokens"),
        input: numberFieldOf(usage, "inputTokens"),
        output: numberFieldOf(usage, "outputTokens") + numberFieldOf(usage, "thoughtTokens"),
      };

const updateTokenFields = ["cacheCreationTokens", "cachedReadTokens", "inputTokens", "outputTokens"] as const;

/**
 * The token fields a `usage_update` carries in the ACP field names; null for a provider whose update carries only the
 * context, so that a turn which reported no counts is unknown and never recorded as zero tokens.
 */
export const acpUpdateUsageOf = (update: unknown): TokenUsage | null =>
  updateTokenFields.every((field) => typeof fieldOf(update, field) !== "number")
    ? null
    : {
        cacheCreation: numberFieldOf(update, "cacheCreationTokens"),
        cacheRead: numberFieldOf(update, "cachedReadTokens"),
        input: numberFieldOf(update, "inputTokens"),
        output: numberFieldOf(update, "outputTokens"),
      };

/** The turn's usage from a `cumulative` session's totals: what grew since the last prompt, or the whole when one fell. */
export const acpCumulativeUsageDeltaOf = (
  previous: TokenUsage,
  reported: TokenUsage,
): { readonly delta: TokenUsage; readonly next: TokenUsage } => {
  const grew =
    reported.input >= previous.input && reported.output >= previous.output && reported.cacheRead >= previous.cacheRead;
  return {
    delta: grew
      ? {
          cacheCreation: 0,
          cacheRead: reported.cacheRead - previous.cacheRead,
          input: reported.input - previous.input,
          output: reported.output - previous.output,
        }
      : reported,
    next: reported,
  };
};
