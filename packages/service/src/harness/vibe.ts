import type { BillingKind, TokenUsage } from "@outlore/contracts";
import { type Duration, Effect, Result } from "effect";
import {
  type Containment,
  fieldOf,
  type HarnessAdapter,
  HarnessFailure,
  numberFieldOf,
  readImages,
  type ThreadAccess,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { readAcpPrompt } from "./acpPrompt.ts";
import { acpRestartKeyOf, loadAcpSession, permissionOptionIdOf } from "./acpSession.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
} from "./harnessProcesses.ts";
import { type RpcIncoming, type RpcProcess, startRpcProcess } from "./lineProcess.ts";
import { findFirstOutside, promptOf } from "./openCodePrompts.ts";
import { toolServerName } from "./toolNames.ts";
import { billingOf, childEnvironment, initializeParams, readVibePlanLimits } from "./vibeAccount.ts";

// Mistral Vibe through `vibe-acp`, its Agent Client Protocol server (JSON-RPC 2.0, one message per line on its
// standard streams; `agent-client-protocol` 0.11.0, schema v1.16.0, probed in mistral-vibe 3.1.3): one process
// per thread, one ACP session per Outlore thread, one `session/prompt` per turn.

/** How the Vibe adapter starts its harness. */
export type VibeOptions = {
  /** The ACP server executable; `vibe-acp` on the PATH by default. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the adapter's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

interface VibeConnection extends HarnessConnection {
  /** How the account is billed, from its `_account/read` answer at session open; a subscription when it reports none. */
  readonly billing: BillingKind;
  /** The starting context, prepended to the first prompt of a session this process opened; null once given. */
  contextToGive: string | null;
  /** The thread's conversation so far, for a session opened in place of one Vibe could not load; null once given. */
  handoverNotes: string | null;
  /** The session's cumulative usage of the last model call, so a turn's usage is the delta. */
  lastUsage: TokenUsage;
  readonly rpc: RpcProcess;
  /**
   * Whether the agent advertised that it takes images (ACP `agentCapabilities.promptCapabilities.image`); false
   * refuses images (message-attachments).
   */
  readonly takesImages: boolean | null;
  /** The tool calls seen so far, by id, so a permission request naming only an id can be judged. */
  readonly toolCalls: Map<string, unknown>;
}

/**
 * The session's MCP servers: Outlore's own tool server, as an HTTP MCP server (ACP `HttpMcpServer`). Vibe requires
 * `type` and `headers` and answers -32602 Invalid params without them.
 */
const mcpServersOf = (access: ThreadAccess) => [
  { headers: [], name: toolServerName, type: "http", url: access.mcpUrl },
];

/** The modes a session's answer lists, by id. */
const modeIdsOf = (modes: unknown): ReadonlyArray<string> => {
  const available = fieldOf(modes, "availableModes");
  return Array.isArray(available) ? available.flatMap((mode) => textFieldOf(mode, "id") ?? []) : [];
};

/** Vibe's token usage of one prompt's answer, which sums the whole session: the turn's own is the delta. */
const usageOf = (usage: unknown): TokenUsage | null =>
  usage === undefined || usage === null
    ? null
    : {
        cacheCreation: 0,
        cacheRead: numberFieldOf(usage, "cachedReadTokens"),
        input: numberFieldOf(usage, "inputTokens"),
        output: numberFieldOf(usage, "outputTokens") + numberFieldOf(usage, "thoughtTokens"),
      };

/** The turn's usage from the session's cumulative totals: what grew since the last call, or the whole when one fell. */
const turnUsageOf = (connection: VibeConnection, reported: TokenUsage | null): TokenUsage | null => {
  if (reported === null) return null;
  const last = connection.lastUsage;
  const grew = reported.input >= last.input && reported.output >= last.output && reported.cacheRead >= last.cacheRead;
  const turn = grew
    ? {
        cacheCreation: 0,
        cacheRead: reported.cacheRead - last.cacheRead,
        input: reported.input - last.input,
        output: reported.output - last.output,
      }
    : reported;
  connection.lastUsage = reported;
  return turn;
};

/**
 * Answers one of Vibe's permission requests, asking the owner. The request names only the tool call's id, so the
 * call itself is read from the session updates seen so far. A denial is answered as Vibe's "Deny" option and the
 * turn carries on without the action.
 */
const answerRequest = Effect.fnUntraced(function* (
  connection: VibeConnection,
  request: TurnRequest,
  incoming: Extract<RpcIncoming, { _tag: "Request" }>,
) {
  if (incoming.method !== "session/request_permission")
    return connection.rpc.respondError(incoming.id, `Outlore does not answer ${incoming.method}.`);
  const toolCallId = textFieldOf(fieldOf(incoming.params, "toolCall"), "toolCallId");
  const toolCall =
    (toolCallId === null ? null : connection.toolCalls.get(toolCallId)) ?? fieldOf(incoming.params, "toolCall");
  const answer = yield* request.askOwner(promptOf(toolCall, yield* findFirstOutside(request, toolCall)));
  const wanted = answer.isAllowed ? "allow_once" : "reject_once";
  const optionId = permissionOptionIdOf(incoming.params, wanted) ?? wanted;
  connection.rpc.respond(incoming.id, { outcome: { optionId, outcome: "selected" } });
});

/** The line a thread shows when Vibe could not pick up the thread's earlier session. */
const lostSessionNote =
  "Mistral Vibe could not pick up this thread's earlier conversation: it is not in Vibe's own folder for this " +
  "account. The thread carries on in a new Vibe session, which was given the thread's conversation so far, as when " +
  "a thread changes harness.";

/** Vibe's ACP protocol: one ACP session per Outlore thread, one prompt per turn. */
const vibeProtocolOf = (options: VibeOptions): HarnessProtocol<VibeConnection> => ({
  interrupt: (connection) =>
    Effect.sync(() => {
      connection.rpc.notify("session/cancel", { sessionId: connection.sessionId });
      return true;
    }),

  // A changed context, access, account, model, effort, or folder restarts the process, loading its session.
  restartKeyOf: acpRestartKeyOf,

  runTurn: Effect.fnUntraced(function* (connection: VibeConnection, request: TurnRequest, turn: PooledTurn) {
    // A fresh session's first prompt carries the starting context; a loaded one already holds it.
    const context = connection.contextToGive;
    const notes = connection.handoverNotes;
    connection.contextToGive = null;
    connection.handoverNotes = null;
    let text = turnMessageOf(request);
    if (notes !== null) text = `${notes}\n\n${text}`;
    if (context !== null) text = `${context}\n\n${text}`;
    const images = yield* readImages(request.images);
    if (images.length > 0 && connection.takesImages === false)
      return yield* new HarnessFailure({
        reason:
          "Mistral Vibe's agent does not take images. Send the message without them, or hand the thread to a runner that does.",
      });
    let draft = "";
    /** A reply is complete once Vibe moves on from writing it, such as to a tool call. */
    const finishDraft = Effect.suspend(() => {
      const reply = draft;
      draft = "";
      return reply.trim() === "" ? Effect.void : request.onEvent({ _tag: "Reply", text: reply });
    });
    let contextTokens: number | null = null;
    const read = Effect.fnUntraced(function* (incoming: RpcIncoming) {
      if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
      if (incoming._tag === "Request") return yield* turn.fork(answerRequest(connection, request, incoming));
      if (incoming.method !== "session/update") return;
      if (textFieldOf(incoming.params, "sessionId") !== connection.sessionId) return;
      const update = fieldOf(incoming.params, "update");
      const kind = textFieldOf(update, "sessionUpdate");
      if (kind === "agent_message_chunk") {
        draft += textFieldOf(fieldOf(update, "content"), "text") ?? "";
        yield* request.onEvent({ _tag: "Draft", text: draft });
      } else if (kind === "tool_call" || kind === "tool_call_update") {
        const id = textFieldOf(update, "toolCallId");
        if (id !== null) connection.toolCalls.set(id, update);
        if (kind === "tool_call") {
          yield* finishDraft;
          yield* request.onEvent({
            _tag: "ToolCall",
            id: id ?? "",
            input: fieldOf(update, "rawInput") ?? {},
            toolName: textFieldOf(update, "title") ?? textFieldOf(update, "kind") ?? "tool",
          });
        }
      } else if (kind === "usage_update") {
        const used = fieldOf(update, "used");
        if (typeof used === "number") contextTokens = used;
      }
    });

    const result = yield* readAcpPrompt(connection.rpc, connection.sessionId, text, images, read);
    yield* finishDraft;
    if (Result.isFailure(result)) return yield* result.failure;
    const usage = turnUsageOf(connection, usageOf(fieldOf(result.success, "usage")));
    turn.reportUsage(usage);
    return {
      billing: connection.billing,
      context: contextTokens,
      isInterrupted: textFieldOf(result.success, "stopReason") === "cancelled" || turn.isInterrupting(),
      usage,
    };
  }),

  start: Effect.fnUntraced(function* (request: TurnRequest) {
    const rpc = yield* startRpcProcess({
      args: [...(options.prefixArgs ?? [])],
      command: options.command,
      cwd: request.cwd,
      env: childEnvironment(request.configDirectory),
      isJsonRpc2: true,
      isTreeKilled: true,
      label: "Mistral Vibe",
    });
    const session = yield* Effect.gen(function* () {
      const initialized = yield* rpc.request("initialize", initializeParams);
      const advertisesImages = fieldOf(
        fieldOf(fieldOf(initialized, "agentCapabilities"), "promptCapabilities"),
        "image",
      );
      const takesImages = typeof advertisesImages === "boolean" ? advertisesImages : null;
      const mcpServers = mcpServersOf(request.access);
      if (request.sessionId !== null) {
        const loaded = yield* loadAcpSession(rpc, request.cwd, request.sessionId, mcpServers);
        if (Result.isSuccess(loaded))
          return { created: loaded.success, handoverNotes: null, isNew: false, takesImages };
        // A session Vibe cannot load is replaced by a new one, given the thread's conversation and starting context.
        const created = yield* rpc.request("session/new", { cwd: request.cwd, mcpServers });
        yield* request.onEvent({ _tag: "Notice", text: lostSessionNote });
        return { created, handoverNotes: yield* request.conversationSoFar, isNew: true, takesImages };
      }
      const created = yield* rpc.request("session/new", { cwd: request.cwd, mcpServers });
      return { created, handoverNotes: null, isNew: true, takesImages };
    }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
    // A loaded session's answer carries no id (the session is the one the load named); a new one's does.
    const sessionId = session.isNew ? textFieldOf(session.created, "sessionId") : request.sessionId;
    if (sessionId === null) {
      rpc.close();
      return yield* new HarnessFailure({ reason: "Mistral Vibe started no session." });
    }
    // Every tool call asks, so Outlore decides each one: the session runs in Vibe's "ask" mode when it offers one.
    if (modeIdsOf(fieldOf(session.created, "modes")).includes("ask"))
      yield* rpc
        .request("session/set_config_option", { configId: "mode", sessionId, value: "ask" })
        .pipe(Effect.ignore);
    // The model and the thinking level are session config options; a refusal ends the start, as OpenCode's.
    const setOption = (configId: string, value: string) =>
      rpc.request("session/set_config_option", { configId, sessionId, value }).pipe(
        Effect.tapError(() => Effect.sync(() => rpc.close())),
        Effect.mapError(
          (failure) =>
            new HarnessFailure({ reason: `Mistral Vibe refused the ${configId} ${value}: ${failure.reason}` }),
        ),
      );
    if (request.model !== "default") yield* setOption("model", request.model);
    if (request.effort !== "default") yield* setOption("thinking", request.effort);
    // How the account is billed, for the turn's record; the plan's limits are read on demand (budget-control).
    const account = yield* rpc.request("_account/read", { sessionId }).pipe(Effect.result);
    return {
      billing: Result.isSuccess(account) ? billingOf(fieldOf(account.success, "plan")) : "Subscription",
      close: rpc.close,
      contextToGive: session.isNew ? request.context : null,
      handoverNotes: session.handoverNotes,
      hasExited: rpc.hasExited,
      lastUsage: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
      rpc,
      sessionId,
      takesImages: session.takesImages,
      toolCalls: new Map(),
    } satisfies VibeConnection;
  }),

  /** ACP takes no message into a running prompt: a steered message waits for the next turn. */
  steer: () => Effect.succeed(false),
});

/**
 * Runs each thread in one long-lived `vibe-acp` process, closed with the scope that made it. Vibe runs without a
 * sandbox Outlore enforces here, so its adapter reports Unprotected: every tool call it asks about asks the owner.
 */
export const makeVibeHarness = (options: VibeOptions) =>
  Effect.map(
    makeHarnessProcesses(vibeProtocolOf(options), options),
    (adapter) =>
      ({
        ...adapter,
        containmentOf: (): Containment => "Unprotected",
        readPlanLimits: (_harness, configDirectory) =>
          readVibePlanLimits(options.command, configDirectory, options.prefixArgs ?? []).pipe(
            Effect.catch(() => Effect.succeed(null)),
          ),
      }) satisfies HarnessAdapter,
  );
