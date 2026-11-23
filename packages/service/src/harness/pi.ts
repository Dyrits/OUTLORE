import type { ModelOption, TokenUsage } from "@outlore/contracts";
import { type Duration, Effect, Queue, type Scope } from "effect";
import {
  fieldOf,
  type HarnessAdapter,
  HarnessFailure,
  numberFieldOf,
  type SteeredMessage,
  type TurnRequest,
  textFieldOf,
  turnMessageOf,
} from "../core/index.ts";
import { type HarnessConnection, type HarnessProtocol, makeHarnessProcesses } from "./harnessProcesses.ts";
import { type PiProcess, startPiProcess } from "./piRpc.ts";
import { denyPiUiRequest, isPiToolExecution, piDenialArgs, piToolBreachOf } from "./piTools.ts";
import { resolvedFolderOf, resolveStartFolder } from "./threadFolder.ts";

/** A provider backed by the Pi CLI. */
export type PiProvider = "pi" | "inception" | "deepseek" | "openrouter";

/**
 * Splits a qualified Pi picker id back into the upstream provider and the model id; null when the id is not qualified.
 * The provider part is URI-encoded, so the first slash is always the separator, whatever slashes the model id holds.
 */
export const piModelPartsOf = (id: string): { readonly model: string; readonly provider: string } | null => {
  const separator = id.indexOf("/");
  if (separator < 1) return null;
  try {
    return { model: id.slice(separator + 1), provider: decodeURIComponent(id.slice(0, separator)) };
  } catch {
    return null;
  }
};

/** Selects the models advertised by Pi for one provider without changing their identifiers. */
export const piModelsOf = (models: ReadonlyArray<unknown>, provider: PiProvider): Array<ModelOption> =>
  models.flatMap((model): Array<ModelOption> => {
    const id = textFieldOf(model, "id");
    const modelProvider = textFieldOf(model, "provider");
    if (id === null || modelProvider === null || (provider !== "pi" && modelProvider !== provider)) return [];
    return [
      {
        efforts: [],
        id: provider === "pi" ? `${encodeURIComponent(modelProvider)}/${id}` : id,
        label: textFieldOf(model, "name") ?? id,
      },
    ];
  });

/** How a Pi-backed harness starts. */
export type PiOptions = {
  /** The executable; `pi` on the PATH by default. */
  readonly command: string;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Pi's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Which of the providers Pi fronts this harness runs; decides how model ids are read and sent. */
  readonly provider: PiProvider;
};

/** The model Pi is told to run: the picker's qualified pair for Pi itself, the id as the provider's own otherwise. */
const piModelSelectionOf = (
  provider: PiProvider,
  model: string,
): { readonly modelId: string; readonly provider: string } | null => {
  if (model === "default") return null;
  if (provider !== "pi") return { modelId: model, provider };
  const parts = piModelPartsOf(model);
  return parts === null ? null : { modelId: parts.model, provider: parts.provider };
};

/** Pi's own thinking levels; an effort outside them, or the default, leaves the model's own. */
const piThinkingLevels: ReadonlyArray<string> = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
const piThinkingLevelOf = (effort: string): string | null =>
  effort === "default" || !piThinkingLevels.includes(effort) ? null : effort;

/** The text of one Pi message: its text content items joined, empty when it has none. */
const piMessageTextOf = (message: unknown): string => {
  const content = fieldOf(message, "content");
  return Array.isArray(content)
    ? content
        .flatMap((item): Array<string> => {
          const text = textFieldOf(item, "text");
          return textFieldOf(item, "type") === "text" && text !== null ? [text] : [];
        })
        .join("")
    : "";
};

/** The turn's usage as Pi's session stats tell it; null when Pi did not answer in time. */
const piUsageOf = (pi: PiProcess) =>
  pi.request({ type: "get_session_stats" }).pipe(
    Effect.map((stats): TokenUsage => {
      const tokens = fieldOf(stats, "tokens");
      const count = (key: string) => Math.max(0, numberFieldOf(tokens, key));
      return {
        cacheCreation: count("cacheWrite"),
        cacheRead: count("cacheRead"),
        input: count("input"),
        output: count("output"),
      };
    }),
    Effect.timeout("2 seconds"),
    Effect.catch(() => Effect.succeed<TokenUsage | null>(null)),
  );

/** A thread's kept Pi process, and the session file it continues. */
interface PiConnection extends HarnessConnection {
  /** The starting context, prepended to the first prompt of a session this process opened; null once given. */
  contextToGive: string | null;
  /** The thread's conversation so far, for a session opened in place of one Pi could not continue. */
  handoverNotes: string | null;
  readonly pi: PiProcess;
}

/** Pi's own protocol, as one kept process per thread. */
const piProtocolOf = (options: PiOptions): HarnessProtocol<PiConnection> => ({
  // Pi's own order for ending a turn: what is queued is dropped first, then the running work is aborted; the turn
  // ends when the agent settles after the abort. A process that no longer answers confirms nothing, which lets the
  // pool end the turn its own way.
  interrupt: (connection: PiConnection) =>
    connection.pi.request({ type: "clear_queue" }).pipe(
      Effect.andThen(connection.pi.request({ type: "abort" })),
      Effect.as(true),
      Effect.catch(() => Effect.succeed(false)),
    ),

  // A changed model, effort, folder, or account restarts the process, continuing its session.
  restartKeyOf: (request) =>
    JSON.stringify([
      options.provider,
      request.model,
      request.effort,
      request.configDirectory,
      resolvedFolderOf(request.cwd),
    ]),

  runTurn: Effect.fnUntraced(function* (connection: PiConnection, request: TurnRequest, turn) {
    if (request.images.length > 0)
      return yield* new HarnessFailure({
        reason: "The Pi adapter takes no image attachments yet.",
      });
    const selection = piModelSelectionOf(options.provider, request.model);
    if (selection !== null)
      yield* connection.pi.request({
        modelId: selection.modelId,
        provider: selection.provider,
        type: "set_model",
      });
    const level = piThinkingLevelOf(request.effort);
    if (level !== null) yield* connection.pi.request({ level, type: "set_thinking_level" });

    let draft = "";
    let failure: string | null = null;
    let isAborted = false;
    // A fresh session's first prompt carries the starting context; a replaced one also carries the thread's
    // conversation so far. A continued session already holds both.
    const context = connection.contextToGive;
    const notes = connection.handoverNotes;
    connection.contextToGive = null;
    connection.handoverNotes = null;
    let message = turnMessageOf(request);
    if (notes !== null) message = `${notes}\n\n${message}`;
    if (context !== null) message = `${context}\n\n${message}`;
    // The prompt request only says Pi took the message in; the turn itself ends when the agent settles. A refusal
    // of the prompt (Pi already runs a turn) ends this turn through the fork's failure.
    yield* turn.fork(connection.pi.request({ message, type: "prompt" }).pipe(Effect.asVoid));
    for (;;) {
      const incoming = yield* Queue.take(connection.pi.incoming);
      if (incoming._tag === "Exit") return yield* new HarnessFailure({ reason: incoming.reason });
      const record = incoming.record;
      if (isPiToolExecution(record)) return yield* piToolBreachOf(record);
      const type = textFieldOf(record, "type");
      if (type === "extension_ui_request") {
        // Until Outlore mediates Pi's questions, every one is refused; the agent settles after the refusal.
        yield* denyPiUiRequest(connection.pi, record);
        continue;
      }
      if (type === "message_update") {
        const update = fieldOf(record, "assistantMessageEvent");
        if (textFieldOf(update, "type") === "text_delta") {
          draft += textFieldOf(update, "delta") ?? "";
          yield* request.onEvent({ _tag: "Draft", text: draft });
        }
        continue;
      }
      if (type === "message_end") {
        const message = fieldOf(record, "message");
        draft = "";
        const text = piMessageTextOf(message);
        if (textFieldOf(message, "role") === "assistant" && text.trim() !== "")
          yield* request.onEvent({ _tag: "Reply", text });
        if (textFieldOf(message, "stopReason") === "error")
          failure = textFieldOf(message, "errorMessage") ?? "Pi reported a failed model call.";
        if (textFieldOf(message, "stopReason") === "aborted") isAborted = true;
        continue;
      }
      if (type === "agent_settled") break;
    }
    if (turn.isInterrupting() || isAborted) return { isInterrupted: true, usage: yield* piUsageOf(connection.pi) };
    if (failure !== null) return yield* new HarnessFailure({ reason: failure });
    return { isInterrupted: false, usage: yield* piUsageOf(connection.pi) };
  }),

  start: Effect.fnUntraced(function* (request: TurnRequest) {
    const cwd = yield* resolveStartFolder(request, "Pi");
    const pi = yield* startPiProcess({
      args: [...(request.sessionId === null ? [] : ["--session", request.sessionId]), ...piDenialArgs],
      command: options.command,
      cwd,
      env: {
        PWD: cwd,
        ...(request.configDirectory === null ? {} : { PI_CODING_AGENT_DIR: request.configDirectory }),
        ...(options.env ?? {}),
      },
      label: "Pi",
      ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    });
    const state = yield* pi.request({ type: "get_state" });
    const sessionId = textFieldOf(state, "sessionFile");
    if (sessionId === null) {
      pi.close();
      return yield* new HarnessFailure({ reason: "Pi opened no session." });
    }
    // A session Pi could not continue is replaced, visibly, rather than silently losing the thread's history.
    if (request.sessionId !== null && sessionId !== request.sessionId) {
      yield* request.onEvent({
        _tag: "Notice",
        text: `Pi could not continue session ${request.sessionId}; a new session ${sessionId} was opened instead.`,
      });
    }
    return {
      close: pi.close,
      contextToGive: request.sessionId === null ? request.context : null,
      handoverNotes:
        request.sessionId !== null && sessionId !== request.sessionId ? yield* request.conversationSoFar : null,
      hasExited: pi.hasExited,
      pi,
      sessionId,
    } satisfies PiConnection;
  }),

  // Pi takes a steered message through its queue, whose clear-on-interrupt interplay this adapter does not
  // mediate yet: the pool closes the process instead, and the message starts the next turn (provisional).
  steer: (_connection: PiConnection, _message: SteeredMessage) => Effect.succeed(false),
});

/** Runs each thread on one kept Pi process with every tool source denied; the processes close with the scope that made them. */
export const makePiHarness = (options: PiOptions): Effect.Effect<HarnessAdapter, never, Scope.Scope> =>
  makeHarnessProcesses(piProtocolOf(options), options);
