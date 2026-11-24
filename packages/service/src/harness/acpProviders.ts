import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TokenUsage } from "@outlore/contracts";
import { type Duration, Effect, Queue, Result } from "effect";
import {
  type Containment,
  fieldOf,
  type HarnessAdapter,
  HarnessFailure,
  numberFieldOf,
  type RpcIncoming,
  type RpcProcess,
  readImages,
  reducedEnvironmentOf,
  startRpcProcess,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { readAcpPrompt } from "./acpPrompt.ts";
import type { AcpProviderProfile } from "./acpProviderProfiles.ts";
import { acpRestartKeyOf, loadAcpSession, permissionOptionIdOf } from "./acpSession.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
} from "./harnessProcesses.ts";
import { noToolServerInstructions } from "./instructions.ts";
import { findFirstOutside, promptOf } from "./openCodePrompts.ts";
import { toolServerName } from "./toolNames.ts";
import { initializeParams } from "./vibeAccount.ts";

// ACP (Agent Client Protocol) providers beyond the harnesses Outlore already runs: audited launch profiles
// (acpProviderProfiles.ts), a read-only model probe, and a turn adapter that keeps one process per thread and
// mediates every `session/request_permission` through the owner, as the Vibe adapter does.

/** A model advertised by an ACP session. */
export type AcpProviderModel = { readonly id: string; readonly label: string };

/** Probe a fresh session without sending a prompt or exposing the thread's MCP server. */
export const probeAcpProviderModels = Effect.fnUntraced(function* (options: {
  readonly command: string;
  readonly profile: AcpProviderProfile;
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Keep JSON-RPC error codes when the caller needs to distinguish authentication failures. */
  readonly preserveProviderErrors?: boolean;
  /**
   * A caller-supplied state home for profiles that need one configured (`needsConfiguredStateHome`): the
   * probe uses it as the profile's state home verbatim, neither creating nor removing it, so a prepared
   * account home can be probed instead of an empty redirect.
   */
  readonly stateHome?: string;
}) {
  const stateHomeEnv = options.profile.stateHomeEnv;
  if (
    stateHomeEnv !== undefined &&
    options.profile.needsConfiguredStateHome === true &&
    options.stateHome === undefined
  )
    return yield* new HarnessFailure({
      reason: `${options.profile.label} reads its models only from a configured state home: give the account's ${stateHomeEnv} folder as stateHome.`,
    });
  const cwd = yield* Effect.sync(() => mkdtempSync(join(tmpdir(), "outlore-acp-probe-")));
  return yield* Effect.gen(function* () {
    const stateHome = stateHomeEnv === undefined ? null : (options.stateHome ?? join(cwd, "state-home"));
    if (stateHome !== null && options.stateHome === undefined)
      yield* Effect.sync(() => mkdirSync(stateHome, { recursive: true }));
    const rpc = yield* startRpcProcess({
      args: [...(options.prefixArgs ?? []), ...options.profile.args],
      command: options.command,
      cwd,
      env: reducedEnvironmentOf({
        ...options.profile.env,
        ...(stateHome === null || stateHomeEnv === undefined ? {} : { [stateHomeEnv]: stateHome }),
      }),
      isJsonRpc2: true,
      isTreeKilled: true,
      label: options.profile.label,
    });
    return yield* Effect.gen(function* () {
      const probeFailure = (step: string) =>
        Effect.mapError((failure: unknown) =>
          options.preserveProviderErrors === true && failure instanceof HarnessFailure
            ? failure
            : new HarnessFailure({ reason: `${options.profile.label} did not answer ${step} in time.` }),
        );
      yield* rpc.request("initialize", initializeParams).pipe(Effect.timeout("20 seconds"), probeFailure("initialize"));
      const session = yield* rpc
        .request("session/new", { cwd, mcpServers: [] })
        .pipe(Effect.timeout("20 seconds"), probeFailure("session/new"));
      const models = fieldOf(fieldOf(session, "models"), "availableModels");
      if (Array.isArray(models))
        return models.flatMap((model): Array<AcpProviderModel> => {
          const id = textFieldOf(model, "modelId");
          return id === null ? [] : [{ id, label: textFieldOf(model, "name") ?? id }];
        });
      const config = fieldOf(session, "configOptions");
      if (!Array.isArray(config)) return [];
      return config.flatMap((option): Array<AcpProviderModel> => {
        const choices = textFieldOf(option, "id") === "model" ? fieldOf(option, "options") : null;
        if (!Array.isArray(choices)) return [];
        return choices.flatMap((choice): Array<AcpProviderModel> => {
          const id = textFieldOf(choice, "value");
          return id === null ? [] : [{ id, label: textFieldOf(choice, "name") ?? id }];
        });
      });
    }).pipe(Effect.ensuring(Effect.sync(() => rpc.close()).pipe(Effect.andThen(Queue.shutdown(rpc.incoming)))));
  }).pipe(Effect.ensuring(Effect.sync(() => rmSync(cwd, { force: true, recursive: true }))));
});

/** How the generic ACP adapter starts one provider's harness. */
export type AcpProviderHarnessOptions = {
  /** The provider's ACP executable. */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /**
   * The MCP servers the session is given. By default the thread's own tool server, when the agent advertises HTTP MCP
   * support (`mcpCapabilities.http`); none otherwise.
   */
  readonly mcpServers?: ReadonlyArray<object>;
  /** Arguments placed before the profile's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  readonly profile: AcpProviderProfile;
};

/** A thread's running provider process, as the adapter opened it. */
interface AcpProviderConnection extends HarnessConnection {
  /** The starting context, prepended to the first prompt of a session this process opened; null once given. */
  contextToGive: string | null;
  /** The thread's conversation so far, for a session opened in place of one the provider could not load. */
  handoverNotes: string | null;
  readonly rpc: RpcProcess;
  /** Whether the agent advertised that it takes images (ACP `promptCapabilities.image`); false refuses them. */
  readonly takesImages: boolean | null;
  /** The tool calls seen so far, by id, so a permission request naming only an id can be judged. */
  readonly toolCalls: Map<string, unknown>;
}

/** The modes a session's answer lists, by id. */
const modeIdsOf = (modes: unknown): ReadonlyArray<string> => {
  const available = fieldOf(modes, "availableModes");
  return Array.isArray(available) ? available.flatMap((mode) => textFieldOf(mode, "id") ?? []) : [];
};

/** The config options a session's answer offers, by id. */
const configOptionIdsOf = (configOptions: unknown): ReadonlyArray<string> =>
  Array.isArray(configOptions) ? configOptions.flatMap((option) => textFieldOf(option, "id") ?? []) : [];

/** The usage of one model call from a `usage_update`, in the ACP field names. */
const usageOf = (update: unknown): TokenUsage => ({
  cacheCreation: numberFieldOf(update, "cacheCreationTokens"),
  cacheRead: numberFieldOf(update, "cachedReadTokens"),
  input: numberFieldOf(update, "inputTokens"),
  output: numberFieldOf(update, "outputTokens"),
});

const noUsage: TokenUsage = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };

/** The line a thread shows when the provider could not pick up the thread's earlier session. */
const lostSessionNoteOf = (label: string) =>
  `${label} could not pick up this thread's earlier conversation: it is not in the provider's own folder for ` +
  "this account. The thread carries on in a new session, which was given the thread's conversation so far, as " +
  "when a thread changes harness.";

/**
 * Answers one of the provider's permission requests, asking the owner. A denial is answered with the
 * provider's reject option and the turn carries on without the action.
 */
const answerRequest = Effect.fnUntraced(function* (
  connection: AcpProviderConnection,
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

/** The generic ACP protocol: one ACP session per Outlore thread, one prompt per turn. */
const acpProviderProtocolOf = (options: AcpProviderHarnessOptions): HarnessProtocol<AcpProviderConnection> => ({
  interrupt: (connection) =>
    Effect.sync(() => {
      connection.rpc.notify("session/cancel", { sessionId: connection.sessionId });
      return true;
    }),

  // A changed context, access, account, model, effort, or folder restarts the process, loading its session.
  restartKeyOf: acpRestartKeyOf,

  runTurn: Effect.fnUntraced(function* (connection: AcpProviderConnection, request: TurnRequest, turn: PooledTurn) {
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
        reason: `${options.profile.label}'s agent does not take images. Send the message without them, or hand the thread to a runner that does.`,
      });
    let draft = "";
    /** A reply is complete once the provider moves on from writing it, such as to a tool call. */
    const finishDraft = Effect.suspend(() => {
      const reply = draft;
      draft = "";
      return reply.trim() === "" ? Effect.void : request.onEvent({ _tag: "Reply", text: reply });
    });
    let usage = noUsage;
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
        const reported = usageOf(update);
        usage = {
          cacheCreation: usage.cacheCreation + reported.cacheCreation,
          cacheRead: usage.cacheRead + reported.cacheRead,
          input: usage.input + reported.input,
          output: usage.output + reported.output,
        };
      }
    });

    const result = yield* readAcpPrompt(connection.rpc, connection.sessionId, text, images, read);
    yield* finishDraft;
    if (Result.isFailure(result)) return yield* result.failure;
    turn.reportUsage(usage);
    return {
      isInterrupted: textFieldOf(result.success, "stopReason") === "cancelled" || turn.isInterrupting(),
      usage,
    };
  }),

  start: Effect.fnUntraced(function* (request: TurnRequest) {
    const stateHomeEnv = options.profile.stateHomeEnv;
    // A provider whose home must be configured runs only against its account folder: without one it would
    // fall back to the user's own provider directory (unrepaired, or worse, holding the owner's sign-in),
    // so the turn fails instead of starting.
    if (
      stateHomeEnv !== undefined &&
      options.profile.needsConfiguredStateHome === true &&
      request.configDirectory === null
    )
      return yield* new HarnessFailure({
        reason: `${options.profile.label} runs against the account folder, and this thread has none to be its ${stateHomeEnv} state home.`,
      });
    const rpc = yield* startRpcProcess({
      args: [...(options.prefixArgs ?? []), ...options.profile.args],
      command: options.command,
      cwd: request.cwd,
      // The account's own folder becomes the provider's state home, so its sign-in, sessions, config, and MCP
      // inheritance stay with the account (provider-accounts); without one, the provider uses its own default.
      env: reducedEnvironmentOf({
        ...options.profile.env,
        ...(stateHomeEnv === undefined || request.configDirectory === null
          ? {}
          : { [stateHomeEnv]: request.configDirectory }),
      }),
      isJsonRpc2: true,
      isTreeKilled: true,
      label: options.profile.label,
    });
    const session = yield* Effect.gen(function* () {
      const initialized = yield* rpc.request("initialize", initializeParams);
      const takesHttpServers = fieldOf(fieldOf(fieldOf(initialized, "agentCapabilities"), "mcpCapabilities"), "http");
      const mcpServers =
        options.mcpServers ??
        (takesHttpServers === true
          ? [{ headers: [], name: toolServerName, type: "http", url: request.access.mcpUrl }]
          : []);
      const hasToolServer = mcpServers.length > 0;
      const advertisesImages = fieldOf(
        fieldOf(fieldOf(initialized, "agentCapabilities"), "promptCapabilities"),
        "image",
      );
      const takesImages = typeof advertisesImages === "boolean" ? advertisesImages : null;
      if (request.sessionId !== null) {
        const loaded = yield* loadAcpSession(rpc, request.cwd, request.sessionId, mcpServers);
        if (Result.isSuccess(loaded))
          return { created: loaded.success, handoverNotes: null, hasToolServer, isNew: false, takesImages };
        // A session the provider cannot load is replaced by a new one, given the thread's conversation so far.
        const created = yield* rpc.request("session/new", { cwd: request.cwd, mcpServers });
        yield* request.onEvent({ _tag: "Notice", text: lostSessionNoteOf(options.profile.label) });
        return {
          created,
          handoverNotes: yield* request.conversationSoFar,
          hasToolServer,
          isNew: true,
          takesImages,
        };
      }
      const created = yield* rpc.request("session/new", { cwd: request.cwd, mcpServers });
      return { created, handoverNotes: null, hasToolServer, isNew: true, takesImages };
    }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
    // A loaded session's answer carries no id (the session is the one the load named); a new one's does.
    const sessionId = session.isNew ? textFieldOf(session.created, "sessionId") : request.sessionId;
    if (sessionId === null) {
      rpc.close();
      return yield* new HarnessFailure({ reason: `${options.profile.label} started no session.` });
    }
    // Every tool call asks, so Outlore decides each one: the session runs in its "ask" mode when it offers one,
    // and never a mode that would answer permissions itself.
    if (modeIdsOf(fieldOf(session.created, "modes")).includes("ask"))
      yield* rpc
        .request("session/set_config_option", { configId: "mode", sessionId, value: "ask" })
        .pipe(Effect.ignore);
    // The model and the thinking level are set only where the session offered them; a refusal ends the start.
    const offered = configOptionIdsOf(fieldOf(session.created, "configOptions"));
    const setOption = (configId: string, value: string) =>
      rpc.request("session/set_config_option", { configId, sessionId, value }).pipe(
        Effect.tapError(() => Effect.sync(() => rpc.close())),
        Effect.mapError(
          (failure) =>
            new HarnessFailure({
              reason: `${options.profile.label} refused the ${configId} ${value}: ${failure.reason}`,
            }),
        ),
      );
    if (request.model !== "default" && offered.includes("model")) yield* setOption("model", request.model);
    if (request.effort !== "default" && offered.includes("thinking")) yield* setOption("thinking", request.effort);
    return {
      close: rpc.close,
      // The starting context promises the thread tools; a session given no tool server is told they are not there.
      contextToGive: session.isNew
        ? session.hasToolServer
          ? request.context
          : `${request.context}\n\n${noToolServerInstructions}`
        : null,
      handoverNotes: session.handoverNotes,
      hasExited: rpc.hasExited,
      rpc,
      sessionId,
      takesImages: session.takesImages,
      toolCalls: new Map(),
    } satisfies AcpProviderConnection;
  }),

  /** ACP takes no message into a running prompt: a steered message waits for the next turn. */
  steer: () => Effect.succeed(false),
});

/**
 * Runs each thread in one long-lived process of the provider's ACP server, closed with the scope that made it.
 * These providers run without a sandbox Outlore enforces here, so the adapter reports Unprotected: every tool
 * call it asks about asks the owner.
 */
export const makeAcpProviderHarness = (options: AcpProviderHarnessOptions) =>
  Effect.map(
    makeHarnessProcesses(acpProviderProtocolOf(options), options),
    (adapter) => ({ ...adapter, containmentOf: (): Containment => "Unprotected" }) satisfies HarnessAdapter,
  );
