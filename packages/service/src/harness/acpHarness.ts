import type { BillingKind, Choice, TokenUsage } from "@outlore/contracts";
import { type Duration, Effect, Result } from "effect";
import {
  type Containment,
  fieldOf,
  type HarnessAdapter,
  HarnessFailure,
  type HarnessPrompt,
  numberFieldOf,
  type RpcIncoming,
  type RpcProcess,
  readImages,
  startRpcProcess,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { readAcpPrompt } from "./acpPrompt.ts";
import {
  acpInitializeParams,
  acpRestartKeyOf,
  acpToolServersOf,
  configOptionIdsOf,
  modeIdsOf,
  permissionOptionIdOf,
  reopenAcpSession,
  thinkingConfigIdOf,
} from "./acpSession.ts";
import { acpFileEditsOf } from "./fileEditEvents.ts";
import {
  type HarnessConnection,
  type HarnessProtocol,
  makeHarnessProcesses,
  type PooledTurn,
} from "./harnessProcesses.ts";
import { noToolServerInstructions } from "./instructions.ts";
import { findFirstOutside, promptOf, refusalOf } from "./openCodePrompts.ts";
import { addUsage, contextOf } from "./tokenUsage.ts";

// The Agent Client Protocol as Outlore speaks it to a harness that runs one agent process per thread (JSON-RPC 2.0, one
// message per line): one ACP session per thread, one `session/prompt` per turn. This module owns the protocol once:
// opening or reopening the session, falling back from a session the agent lost, the read loop, permissions and the
// owner's questions, the ask mode, usage and context, file edits and the tool server. A harness differs from another only
// by its dialect (below), so a fix to one of these reaches every harness that runs through it.

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

/** What a dialect's `promptOf` decides the owner's question from. */
export type AcpPermissionContext = {
  readonly launch: AcpLaunch;
  readonly request: TurnRequest;
  readonly rpc: RpcProcess;
  /** The tool call the permission request names, as far as the session's updates and the request itself say. */
  readonly toolCall: unknown;
};

/**
 * What one harness does differently from the standard protocol, as small data and two hooks.
 * Anything not named here is the same for every ACP harness and lives in this module.
 */
export type AcpDialect = {
  /** The harness's name as the owner reads it. */
  readonly label: string;
  /** The process this turn's session runs in, or the reason it cannot run: some providers run only against an account folder. */
  readonly launchOf: (request: TurnRequest) => Effect.Effect<AcpLaunch, HarnessFailure>;
  /**
   * Reads how the account is billed, once the session is open; a failure to read says nothing. Without it a turn's billing is unknown.
   */
  readonly readBilling?: (rpc: RpcProcess, sessionId: string) => Effect.Effect<BillingKind>;
  /** Where the agent's tool calls with this id prefix are questions to choose an answer to, not actions to approve; null when it has none. */
  readonly questionIdPrefix: string | null;
  /**
   * Whether a session the thread knows is reopened with `session/resume` when the agent advertises it:
   * resuming does not replay the session's tool calls to the client, which `session/load` does.
   */
  readonly resumesSessions: boolean;
  /**
   * How the thread's tool server is given: see `acpToolServersOf`.
   * `launch`: the launch hands over the tool server and the starting context itself, through a configuration and a file the agent reads (OpenCode); the session is given neither.
   */
  readonly toolServer: "http" | "launch" | "negotiated";
  /**
   * How a prompt's usage is reported.
   * - `perPrompt`: each answer is that prompt's own; one that reports none leaves the turn's usage to the token counts of its
   *   `usage_update`s, and a turn with neither is unknown.
   * - `cumulative`: each answer sums the whole session, so the turn's usage is what grew; one that reports none is unknown.
   */
  readonly usage: "cumulative" | "perPrompt";
  /** Where a completed call's edits are read from: the standard `diff` blocks, plus what the harness's own results carry. */
  readonly fileEdits: "acp" | "opencode" | "vibe";
  /**
   * Whether the session's model and thinking level are set on the options it listed (the default), or always, as the options `model` and `effort`:
   * OpenCode lists an effort only for the model once chosen, so the effort is set after the model without being listed first.
   */
  readonly setsOptions?: "always" | "offered";
  /** The line a thread shows when the agent could not pick up the thread's earlier session; a standard line naming the harness when absent. */
  readonly lostSessionNote?: string;
  /** Whether a session the agent could not reopen is replaced by a new one; when this says no, the turn fails with the agent's refusal. Always replaced when absent. */
  readonly mayReplaceLostSession?: (launch: AcpLaunch) => boolean;
  /**
   * The namespace under which the agent takes the starting context as its system prompt (Antigravity: `antigravity`).
   * An agent that advertises `agentCapabilities._meta.<namespace>.systemPrompt.append` is given the context in `_meta.<namespace>.systemPrompt.append` of each `session/new`,
   * so the first prompt carries only the owner's message; an agent that does not advertise it is given the context in the first prompt as every agent is.
   */
  readonly systemPromptNamespace?: string;
  /** The turn's context is the token total of its last prompt's answer, not the agent's `usage_update`. */
  readonly contextFromUsage?: boolean;
  /** Whether each tool call is a `ToolCall` event in the thread; true when absent. File edits are reported either way. */
  readonly announcesToolCalls?: boolean;
  /**
   * The question the owner is asked about one permission request, from the request and the launch;
   * the standard question about the tool call, naming the file outside the folder, when absent.
   */
  readonly promptOf?: (context: AcpPermissionContext) => Effect.Effect<HarnessPrompt>;
  /**
   * The agent cancels its whole prompt when the owner refuses a permission, and ACP carries no message with a refusal:
   * each refusal is kept and told to the agent in a new prompt of the same turn, so the thread carries on without the action.
   * An interrupt ends the turn instead.
   */
  readonly repromptsRefusals?: boolean;
};

/** How the unified ACP harness starts. */
export type AcpHarnessOptions = {
  /** The agent's executable. */
  readonly command: string;
  readonly dialect: AcpDialect;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before the dialect's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/** A thread's running agent process, as the protocol opened it. */
interface AcpConnection extends HarnessConnection {
  /** How the account is billed, read when the session opened; null when the dialect reads none. */
  readonly billing: BillingKind | null;
  /** The starting context, prepended to the first prompt of a session this process opened; null once given. */
  contextToGive: string | null;
  /** The thread's conversation so far, for a session opened in place of one the agent could not load; null once given. */
  handoverNotes: string | null;
  /** A `cumulative` dialect's session totals at the last prompt, so a turn's usage is the delta. */
  lastUsage: TokenUsage;
  /** The launch that started the process, for the dialect's judgement of permissions. */
  readonly launch: AcpLaunch;
  readonly rpc: RpcProcess;
  /** Whether the agent advertised that it takes images (ACP `promptCapabilities.image`); false refuses them, null leaves it open. */
  readonly takesImages: boolean | null;
  /** The tool calls seen so far, by id, so a permission request naming only an id can be judged. */
  readonly toolCalls: Map<string, unknown>;
}

/** The usage a prompt's answer reports (ACP `PromptResponse.usage`), thoughts counted as output; null when it reports none. */
const promptUsageOf = (usage: unknown): TokenUsage | null =>
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
const updateUsageOf = (update: unknown): TokenUsage | null =>
  updateTokenFields.every((field) => typeof fieldOf(update, field) !== "number")
    ? null
    : {
        cacheCreation: numberFieldOf(update, "cacheCreationTokens"),
        cacheRead: numberFieldOf(update, "cachedReadTokens"),
        input: numberFieldOf(update, "inputTokens"),
        output: numberFieldOf(update, "outputTokens"),
      };

/** The turn's usage from the session's cumulative totals: what grew since the last prompt, or the whole when one fell. */
const turnUsageOf = (connection: AcpConnection, reported: TokenUsage): TokenUsage => {
  const last = connection.lastUsage;
  const grew = reported.input >= last.input && reported.output >= last.output && reported.cacheRead >= last.cacheRead;
  connection.lastUsage = reported;
  return grew
    ? {
        cacheCreation: 0,
        cacheRead: reported.cacheRead - last.cacheRead,
        input: reported.input - last.input,
        output: reported.output - last.output,
      }
    : reported;
};

/** The line a thread shows when the agent could not pick up the thread's earlier session. */
const lostSessionNoteOf = (label: string) =>
  `${label} could not pick up this thread's earlier conversation: it is not in the provider's own folder for ` +
  "this account. The thread carries on in a new session, which was given the thread's conversation so far, as " +
  "when a thread changes harness.";

/**
 * A question the agent asks through a permission request, as the owner chooses an answer to it.
 * The agent's own options are the choices, each answered by its id; no answer, or text naming none of them, answers cancelled,
 * so the agent never hears an option the owner did not pick.
 */
const answerQuestion = Effect.fnUntraced(function* (
  connection: AcpConnection,
  dialect: AcpDialect,
  request: TurnRequest,
  incoming: Extract<RpcIncoming, { _tag: "Request" }>,
  toolCall: unknown,
) {
  const offered = fieldOf(incoming.params, "options");
  const options = Array.isArray(offered)
    ? offered.flatMap((option) => {
        const optionId = textFieldOf(option, "optionId");
        const name = textFieldOf(option, "name") ?? optionId;
        return optionId === null || name === null ? [] : [{ name, optionId }];
      })
    : [];
  const question = textFieldOf(toolCall, "title") ?? "Choose an option";
  const choice = {
    allowsOther: false,
    header: dialect.label,
    multiple: false,
    options: options.map((option) => ({ description: "", label: option.name })),
    question,
  } satisfies typeof Choice.Type;
  const answer = yield* request.askOwner({
    choices: [choice],
    input: { options: options.map((option) => option.name), question },
    toolName: "request_user_input",
  });
  const chosen = answer.isAllowed ? answer.answers?.[0]?.[0] : undefined;
  const picked = options.find((option) => option.name === chosen);
  connection.rpc.respond(
    incoming.id,
    picked === undefined
      ? { outcome: { outcome: "cancelled" } }
      : { outcome: { optionId: picked.optionId, outcome: "selected" } },
  );
});

/** The question the owner is asked about a tool call: the call, naming the first file it edits outside the thread's folder. */
const standardPromptOf = Effect.fnUntraced(function* ({ request, toolCall }: AcpPermissionContext) {
  return promptOf(toolCall, yield* findFirstOutside(request, toolCall));
});

/**
 * Answers one of the agent's reverse requests: a permission request goes to the owner, any other fails closed.
 * Some agents name only the tool call's id, so the call is read from the session updates seen so far, with what the request itself says on top.
 * A denial is answered with the agent's reject option and the turn carries on without the action;
 * where the agent cancels its prompt for a refusal, the refusal is added to `refusals` before the agent hears it.
 */
const answerRequest = Effect.fnUntraced(function* (
  connection: AcpConnection,
  dialect: AcpDialect,
  request: TurnRequest,
  incoming: Extract<RpcIncoming, { _tag: "Request" }>,
  refusals: Array<string>,
) {
  if (incoming.method !== "session/request_permission")
    return connection.rpc.respondError(incoming.id, `Outlore does not answer ${incoming.method}.`);
  const named = fieldOf(incoming.params, "toolCall");
  const toolCallId = textFieldOf(named, "toolCallId");
  const seen = toolCallId === null ? undefined : connection.toolCalls.get(toolCallId);
  const toolCall = seen === undefined || seen === null ? named : { ...(seen as object), ...(named as object) };
  if (dialect.questionIdPrefix !== null && toolCallId?.startsWith(dialect.questionIdPrefix) === true)
    return yield* answerQuestion(connection, dialect, request, incoming, toolCall);
  const context = { launch: connection.launch, request, rpc: connection.rpc, toolCall } satisfies AcpPermissionContext;
  const prompt = yield* (dialect.promptOf ?? standardPromptOf)(context);
  const answer = yield* request.askOwner(prompt);
  if (!answer.isAllowed && dialect.repromptsRefusals === true) refusals.push(refusalOf(prompt, answer));
  const optionId = permissionOptionIdOf(incoming.params, answer.isAllowed ? "allow_once" : "reject_once");
  // An agent that offers no such option hears the request cancelled, never an option id it did not offer.
  connection.rpc.respond(
    incoming.id,
    optionId === null ? { outcome: { outcome: "cancelled" } } : { outcome: { optionId, outcome: "selected" } },
  );
});

/** The ACP protocol of one harness: one ACP session per Outlore thread, one prompt per turn. */
const acpProtocolOf = (options: AcpHarnessOptions): HarnessProtocol<AcpConnection> => {
  const { dialect } = options;

  return {
    interrupt: (connection) =>
      Effect.sync(() => {
        connection.rpc.notify("session/cancel", { sessionId: connection.sessionId });
        return true;
      }),

    // A changed context, access, account, model, effort, or folder restarts the process, loading its session.
    restartKeyOf: acpRestartKeyOf,

    runTurn: Effect.fnUntraced(function* (connection: AcpConnection, request: TurnRequest, turn: PooledTurn) {
      // A fresh session's first prompt carries the starting context; a reopened one already holds it.
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
          reason: `${dialect.label}'s agent does not take images. Send the message without them, or hand the thread to a runner that does.`,
        });
      // The refusals of the owner that the agent has not heard yet: see `repromptsRefusals`.
      const refusals: Array<string> = [];
      let usage: TokenUsage | null = null;
      // One prompt, whose updates are read until its answer. The turn's images go with its first prompt only.
      const readPrompt = Effect.fnUntraced(function* (promptText: string, promptImages: typeof images) {
        let draft = "";
        /** A reply is complete once the agent moves on from writing it, such as to a tool call. */
        const finishDraft = Effect.suspend(() => {
          const reply = draft;
          draft = "";
          return reply.trim() === "" ? Effect.void : request.onEvent({ _tag: "Reply", text: reply });
        });
        let contextTokens: number | null = null;
        let contextWindow: number | null = null;
        let updateUsage: TokenUsage | null = null;
        const read = Effect.fnUntraced(function* (incoming: RpcIncoming) {
          if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
          if (incoming._tag === "Request")
            return yield* turn.fork(answerRequest(connection, dialect, request, incoming, refusals));
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
              if (dialect.announcesToolCalls !== false)
                yield* request.onEvent({
                  _tag: "ToolCall",
                  id: id ?? "",
                  input: fieldOf(update, "rawInput") ?? {},
                  toolName: textFieldOf(update, "title") ?? textFieldOf(update, "kind") ?? "tool",
                });
            }
            for (const event of acpFileEditsOf(update, connection.sessionId, dialect.fileEdits))
              yield* request.onEvent(event);
          } else if (kind === "usage_update") {
            // The standard fields name the context's size; a provider may add token fields of its own.
            const used = fieldOf(update, "used");
            if (typeof used === "number") contextTokens = used;
            const size = fieldOf(update, "size");
            if (typeof size === "number" && size > 0) contextWindow = size;
            updateUsage = addUsage(updateUsage, updateUsageOf(update));
          }
        });

        const result = yield* readAcpPrompt(connection.rpc, connection.sessionId, promptText, promptImages, read);
        yield* finishDraft;
        if (Result.isFailure(result)) return yield* result.failure;
        const reported = promptUsageOf(fieldOf(result.success, "usage"));
        const promptUsage =
          reported !== null
            ? dialect.usage === "cumulative"
              ? turnUsageOf(connection, reported)
              : reported
            : dialect.usage === "cumulative"
              ? null
              : updateUsage;
        return {
          context: dialect.contextFromUsage === true ? contextOf(reported) : contextTokens,
          contextWindow,
          isCancelled: textFieldOf(result.success, "stopReason") === "cancelled",
          usage: promptUsage,
        };
      });

      let end = yield* readPrompt(text, images);
      for (;;) {
        usage = addUsage(usage, end.usage);
        // Each prompt's usage counts at once, so a later prompt that fails keeps what the earlier ones used.
        turn.reportUsage(usage);
        if (!(dialect.repromptsRefusals === true && end.isCancelled && refusals.length > 0 && !turn.isInterrupting()))
          break;
        end = yield* readPrompt(refusals.splice(0).join("\n"), []);
      }
      return {
        ...(connection.billing === null ? {} : { billing: connection.billing }),
        // The latest prompt's own reading stands for the context: the sum of usage covers every prompt of the turn.
        context: end.context,
        contextWindow: end.contextWindow,
        isInterrupted: end.isCancelled || turn.isInterrupting(),
        usage,
      };
    }),

    start: Effect.fnUntraced(function* (request: TurnRequest) {
      const launch = yield* dialect.launchOf(request);
      const rpc = yield* startRpcProcess({
        args: launch.command === undefined ? [...(options.prefixArgs ?? []), ...launch.args] : launch.args,
        command: launch.command ?? options.command,
        cwd: request.cwd,
        env: launch.env,
        isJsonRpc2: true,
        isTreeKilled: true,
        label: dialect.label,
        ...(launch.onEnded === undefined ? {} : { onEnded: launch.onEnded }),
      });
      const session = yield* Effect.gen(function* () {
        const initialized = yield* rpc.request("initialize", acpInitializeParams);
        const capabilities = fieldOf(initialized, "agentCapabilities");
        // A launch that hands the tool server over itself gives the session none, and the agent already has its context.
        const mcpServers =
          dialect.toolServer === "launch"
            ? []
            : acpToolServersOf(
                dialect.toolServer,
                request.access,
                fieldOf(fieldOf(capabilities, "mcpCapabilities"), "http") === true,
              );
        const hasToolServer = dialect.toolServer === "launch" || mcpServers.length > 0;
        const advertisesImages = fieldOf(fieldOf(capabilities, "promptCapabilities"), "image");
        const takesImages = typeof advertisesImages === "boolean" ? advertisesImages : null;
        const resume = fieldOf(fieldOf(capabilities, "sessionCapabilities"), "resume");
        const canResume = dialect.resumesSessions && resume !== undefined && resume !== null && resume !== false;
        // The starting context promises the thread tools; a session given no tool server is told they are not there.
        const startingContext = hasToolServer ? request.context : `${request.context}\n\n${noToolServerInstructions}`;
        const namespace = dialect.systemPromptNamespace;
        const isAppended =
          namespace !== undefined &&
          fieldOf(fieldOf(fieldOf(fieldOf(capabilities, "_meta"), namespace), "systemPrompt"), "append") === true;
        const newSession = rpc.request("session/new", {
          cwd: request.cwd,
          mcpServers,
          ...(isAppended ? { _meta: { [namespace]: { systemPrompt: { append: startingContext } } } } : {}),
        });
        if (request.sessionId !== null) {
          const reopened = yield* reopenAcpSession(rpc, {
            canResume,
            cwd: request.cwd,
            mcpServers,
            sessionId: request.sessionId,
          });
          if (Result.isSuccess(reopened))
            return {
              created: reopened.success,
              handoverNotes: null,
              isAppended,
              isNew: false,
              startingContext,
              takesImages,
            };
          // A session the agent cannot open is replaced by a new one, given the thread's conversation so far,
          // unless the dialect fails the turn instead or the process is gone.
          if (dialect.mayReplaceLostSession?.(launch) === false || rpc.hasExited()) return yield* reopened.failure;
          const created = yield* newSession;
          yield* request.onEvent({ _tag: "Notice", text: dialect.lostSessionNote ?? lostSessionNoteOf(dialect.label) });
          return {
            created,
            handoverNotes: yield* request.conversationSoFar,
            isAppended,
            isNew: true,
            startingContext,
            takesImages,
          };
        }
        const created = yield* newSession;
        return { created, handoverNotes: null, isAppended, isNew: true, startingContext, takesImages };
      }).pipe(Effect.tapError(() => Effect.sync(() => rpc.close())));
      // A reopened session's answer carries no id (the session is the one the request named); a new one's does.
      const sessionId = session.isNew ? textFieldOf(session.created, "sessionId") : request.sessionId;
      if (sessionId === null) {
        rpc.close();
        return yield* new HarnessFailure({ reason: `${dialect.label} started no session.` });
      }
      // Every tool call asks, so Outlore decides each one: the session runs in its "ask" mode when it offers one,
      // and never a mode that would answer permissions itself (Antigravity rejects yolo and auto_edit besides).
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
              new HarnessFailure({ reason: `${dialect.label} refused the ${configId} ${value}: ${failure.reason}` }),
          ),
        );
      const isAlways = dialect.setsOptions === "always";
      if (request.model !== "default" && (isAlways || offered.includes("model")))
        yield* setOption("model", request.model);
      // The effort is an option of the session's model, which an "always" dialect lists only once the model is chosen.
      const thinkingId = isAlways ? "effort" : thinkingConfigIdOf(fieldOf(session.created, "configOptions"));
      if (request.effort !== "default" && thinkingId !== null) yield* setOption(thinkingId, request.effort);
      const billing = dialect.readBilling === undefined ? null : yield* dialect.readBilling(rpc, sessionId);
      return {
        billing,
        close: rpc.close,
        // A launch that gave the context itself, or a session given it as its system prompt, leaves nothing for the first prompt.
        contextToGive:
          session.isNew && dialect.toolServer !== "launch" && !session.isAppended ? session.startingContext : null,
        handoverNotes: session.handoverNotes,
        hasExited: rpc.hasExited,
        lastUsage: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
        launch,
        rpc,
        sessionId,
        takesImages: session.takesImages,
        toolCalls: new Map(),
      } satisfies AcpConnection;
    }),

    /** ACP takes no message into a running prompt: a steered message waits for the next turn. */
    steer: () => Effect.succeed(false),
  };
};

/**
 * Runs each thread in one long-lived process of an agent's ACP server, closed with the scope that made it.
 * These agents run without a sandbox Outlore enforces here, so the adapter reports Unprotected: every tool call it asks about asks the owner.
 */
export const makeAcpHarness = (options: AcpHarnessOptions) =>
  Effect.map(
    makeHarnessProcesses(acpProtocolOf(options), options),
    (adapter) => ({ ...adapter, containmentOf: (): Containment => "Unprotected" }) satisfies HarnessAdapter,
  );
