import type { BillingKind, TokenUsage } from "@outlore/contracts";
import { type Duration, Effect, Result } from "effect";
import {
  type Containment,
  fieldOf,
  type HarnessAdapter,
  HarnessFailure,
  type HarnessPrompt,
  type RpcIncoming,
  type RpcProcess,
  readImages,
  type SteeredMessage,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { type AcpLaunch, checkAcpAgentVersion, startAcpRpcProcess } from "./acpLaunch.ts";
import { type AcpPermissionContext, answerAcpRequest } from "./acpPermissions.ts";
import { type AcpPromptFlight, openAcpPromptFlight, readAcpPrompt, steerAcpPrompt } from "./acpPrompt.ts";
import {
  acpAgentVersionOf,
  acpCumulativeUsageDeltaOf,
  acpInitializeParams,
  acpPromptUsageOf,
  acpRestartKeyOf,
  acpToolServersOf,
  acpUpdateUsageOf,
  acpVersionAtLeast,
  configOptionIdsOf,
  modeIdsOf,
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
import { addUsage, contextOf } from "./tokenUsage.ts";

export type { AcpLaunch } from "./acpLaunch.ts";
export type { AcpPermissionContext } from "./acpPermissions.ts";

// The Agent Client Protocol as Outlore speaks it to a harness that runs one agent process per thread (JSON-RPC 2.0, one
// message per line): one ACP session per thread, one `session/prompt` per turn. This module owns the protocol once:
// opening or reopening the session, falling back from a session the agent lost, the read loop, permissions and the
// owner's questions, the ask mode, usage and context, file edits and the tool server. A harness differs from another only
// by its dialect (below), so a fix to one of these reaches every harness that runs through it.

/**
 * What one harness does differently from the standard protocol, as small data and two hooks.
 * Anything not named here is the same for every ACP harness and lives in this module.
 */
export type AcpDialect = {
  /** Whether each spawned ACP process gets a fresh temporary directory as `TMPDIR`, `TMP`, and `TEMP`, removed when the process ends. */
  readonly hasIsolatedTempDir?: boolean;
  /**
   * A pattern matching a failure line the agent writes into an `agent_message_chunk` instead of returning a JSON-RPC error (such as Antigravity's inline quota warning).
   * When matched, the matched line is stripped from the reply and the prompt fails with `HarnessFailure`.
   */
  readonly inlineFailurePattern?: RegExp;
  /** The harness's name as the owner reads it. */
  readonly label: string;
  /** The process this turn's session runs in, or the reason it cannot run: some providers run only against an account folder. */
  readonly launchOf: (request: TurnRequest) => Effect.Effect<AcpLaunch, HarnessFailure>;
  /** The minimum agent version (`initialize`'s `agentInfo.version`) required before opening a session; an agent reporting an older version fails startup. */
  readonly minimumAgentVersion?: string;
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
  /**
   * The agent version (`initialize`'s `agentInfo.version`) from which a second `session/prompt` sent while one runs is a message into it:
   * the agent answers the running prompt `end_turn` and carries the turn on under the new one, leaving its running subagents and commands alone (Antigravity 1.5.0).
   * From that version a steered message is sent as that prompt; before it, with no version reported, or when absent, a steered message waits for the next turn.
   * Interrupting never changes: standard ACP's `session/cancel`.
   */
  readonly steersWithPromptFrom?: string;
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
  /** The running stretch of the turn's prompts, which a steered message joins; null between prompts. */
  flight: AcpPromptFlight | null;
  /** The thread's conversation so far, for a session opened in place of one the agent could not load; null once given. */
  handoverNotes: string | null;
  /** A `cumulative` dialect's session totals at the last prompt, so a turn's usage is the delta. */
  lastUsage: TokenUsage;
  /** The launch that started the process, for the dialect's judgement of permissions. */
  readonly launch: AcpLaunch;
  readonly rpc: RpcProcess;
  /** The messages steered into the running flight that the agent has not yet taken in, by their ids. */
  readonly steered: Array<string>;
  /** Whether this agent takes a steered message as a second prompt: the dialect asks for it and the agent's version is at least the one it names. */
  readonly steersWithPrompt: boolean;
  /** Whether the agent advertised that it takes images (ACP `promptCapabilities.image`); false refuses them, null leaves it open. */
  readonly takesImages: boolean | null;
  /** The tool calls seen so far, by id, so a permission request naming only an id can be judged. */
  readonly toolCalls: Map<string, unknown>;
}

/** The line a thread shows when the agent could not pick up the thread's earlier session. */
const lostSessionNoteOf = (label: string) =>
  `${label} could not pick up this thread's earlier conversation: it is not in the provider's own folder for ` +
  "this account. The thread carries on in a new session, which was given the thread's conversation so far, as " +
  "when a thread changes harness.";

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
      // One prompt, whose updates are read until its answer; a message steered into it makes it a flight of prompts, read until the last one is answered.
      // The turn's images go with its first prompt only.
      const readPrompt = Effect.fnUntraced(function* (promptText: string, promptImages: typeof images) {
        let draft = "";
        let inlineFailure: string | null = null;
        /** What the flight's prompts have reported so far, each counted once; null until one reports usage. */
        let flightUsage: TokenUsage | null = null;
        /** A prompt's usage counts in the flight's, and the prompt's own reading is returned. */
        const countUsage = (answer: unknown) => {
          const reported = acpPromptUsageOf(fieldOf(answer, "usage"));
          if (reported !== null) {
            if (dialect.usage === "cumulative") {
              const { delta, next } = acpCumulativeUsageDeltaOf(connection.lastUsage, reported);
              connection.lastUsage = next;
              flightUsage = addUsage(flightUsage, delta);
            } else flightUsage = addUsage(flightUsage, reported);
          }
          return reported;
        };
        /** The agent has taken the messages steered so far into the turn. */
        const deliverSteered = Effect.suspend(() =>
          Effect.forEach(connection.steered.splice(0), (id) => turn.deliver(id), { discard: true }),
        );
        /** A reply is complete once the agent moves on from writing it, such as to a tool call. */
        const finishDraft = Effect.suspend(() => {
          let reply = draft;
          draft = "";
          if (dialect.inlineFailurePattern !== undefined) {
            const match = dialect.inlineFailurePattern.exec(reply);
            if (match !== null) {
              inlineFailure = match[0].trim();
              reply = reply.replace(dialect.inlineFailurePattern, "").trim();
            }
          }
          return reply.trim() === "" ? Effect.void : request.onEvent({ _tag: "Reply", text: reply });
        });
        let contextTokens: number | null = null;
        let contextWindow: number | null = null;
        let updateUsage: TokenUsage | null = null;
        const read = Effect.fnUntraced(function* (incoming: RpcIncoming) {
          if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
          if (incoming._tag === "Request")
            return yield* turn.fork(answerAcpRequest(connection, dialect, request, incoming, refusals));
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
            updateUsage = addUsage(updateUsage, acpUpdateUsageOf(update));
          }
        });

        const flight = openAcpPromptFlight();
        connection.flight = flight;
        const ended = yield* readAcpPrompt(connection.rpc, connection.sessionId, promptText, promptImages, read, {
          flight,
          // The agent answered the prompt before it, which carried the turn on under the steered one: the steered message is taken in,
          // the reply written so far is complete, and what the prompt used counts at once, so a failure of the last prompt keeps it.
          onSuperseded: (answer) =>
            Effect.gen(function* () {
              countUsage(answer);
              turn.reportUsage(addUsage(usage, flightUsage));
              yield* finishDraft;
              yield* deliverSteered;
            }),
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              connection.flight = null;
              connection.steered.splice(0);
            }),
          ),
        );
        yield* finishDraft;
        if (Result.isFailure(ended.answer)) return yield* ended.answer.failure;
        if (inlineFailure !== null) return yield* new HarnessFailure({ reason: inlineFailure });
        // An answer to the last prompt, even a cancelled one, shows the agent had taken the steered messages in.
        yield* deliverSteered;
        const reported = countUsage(ended.answer.success);
        return {
          context: dialect.contextFromUsage === true ? contextOf(reported) : contextTokens,
          contextWindow,
          isCancelled: textFieldOf(ended.answer.success, "stopReason") === "cancelled",
          usage: flightUsage ?? (dialect.usage === "cumulative" ? null : updateUsage),
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
      const rpc = yield* startAcpRpcProcess({
        args: launch.command === undefined ? [...(options.prefixArgs ?? []), ...launch.args] : launch.args,
        command: launch.command ?? options.command,
        cwd: request.cwd,
        env: launch.env,
        ...(dialect.hasIsolatedTempDir === true ? { hasIsolatedTempDir: true } : {}),
        label: dialect.label,
        ...(launch.onEnded === undefined ? {} : { onEnded: launch.onEnded }),
      });
      let steersWithPrompt = false;
      const session = yield* Effect.gen(function* () {
        const initialized = yield* rpc.request("initialize", acpInitializeParams);
        yield* checkAcpAgentVersion(initialized, dialect.minimumAgentVersion, dialect.label);
        steersWithPrompt =
          dialect.steersWithPromptFrom !== undefined &&
          acpVersionAtLeast(acpAgentVersionOf(initialized), dialect.steersWithPromptFrom);
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
        flight: null,
        handoverNotes: session.handoverNotes,
        hasExited: rpc.hasExited,
        lastUsage: { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 },
        launch,
        rpc,
        sessionId,
        steered: [],
        steersWithPrompt,
        takesImages: session.takesImages,
        toolCalls: new Map(),
      } satisfies AcpConnection;
    }),

    /**
     * Standard ACP takes no message into a running prompt, so a steered message waits for the next turn.
     * An agent the dialect knows takes a second prompt as one (`steersWithPromptFrom`) is sent it, and the message counts as taken in once the agent answers the prompt before it.
     */
    steer: Effect.fnUntraced(function* (connection: AcpConnection, message: SteeredMessage) {
      const flight = connection.flight;
      if (!connection.steersWithPrompt || flight === null) return false;
      // An unreadable image, or one the agent does not take, leaves the message for the next turn, where the turn itself says so.
      const images = yield* readImages(message.images).pipe(Effect.catch(() => Effect.succeed(null)));
      if (images === null || (images.length > 0 && connection.takesImages === false)) return false;
      connection.steered.push(message.id);
      const isSent = yield* steerAcpPrompt(flight, message.text, images);
      if (!isSent) {
        const index = connection.steered.indexOf(message.id);
        if (index >= 0) connection.steered.splice(index, 1);
      }
      return isSent;
    }),
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
