import { Effect, Queue, Result } from "effect";
import type { RpcProcess, ThreadAccess } from "../core/index.ts";
import { fieldOf, type TurnRequest, textFieldOf } from "../core/index.ts";
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
 * How a session is given the thread's tool server, as ACP `McpServer` entries; none when the thread has no tool server.
 * - `http`: always the HTTP server (ACP `HttpMcpServer`), for an agent that validates the entry and answers anything else -32602 Invalid params.
 * - `negotiated`: the HTTP server when the agent advertises `mcpCapabilities.http`, and otherwise the stdio bridge to it, since stdio is the transport ACP requires every agent to take.
 */
export const acpToolServersOf = (
  transport: "http" | "negotiated",
  access: ThreadAccess,
  advertisesHttp: boolean,
): ReadonlyArray<object> => {
  if (access.mcpUrl === "") return [];
  if (transport === "http" || advertisesHttp)
    return [{ headers: [], name: toolServerName, type: "http", url: access.mcpUrl }];
  return [acpStdioMcpServerOf(access.mcpUrl)];
};
