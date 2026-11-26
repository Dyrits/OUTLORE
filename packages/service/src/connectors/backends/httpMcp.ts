import { Effect } from "effect";
import { fieldOf, isRecord, numberFieldOf, textFieldOf } from "../../core/index.ts";
import type { BackendTool, ConnectorBackend } from "../backend.ts";
import { redactedOf } from "../connectorErrors.ts";
import {
  ask,
  clientInfo,
  type HttpTransport,
  notify,
  protocolVersion,
  refuse,
  sessionExpiredWords,
} from "./httpMcpTransport.ts";

// A Streamable-HTTP MCP client (connectors blueprint, Backends): one POST per request, optional session handshake, and fixed-word failures with redacted answers.

/** The tools of a `tools/list` result, or null when the server did not answer a list the adapter can read. */
const toolsOf = (result: unknown): ReadonlyArray<BackendTool> | null => {
  const tools = fieldOf(result, "tools");
  if (!Array.isArray(tools)) return null;
  const read: Array<BackendTool> = [];
  for (const tool of tools) {
    const name = textFieldOf(tool, "name");
    if (name === null) continue;
    const schema = fieldOf(tool, "inputSchema");
    read.push({
      description: textFieldOf(tool, "description") ?? "",
      inputSchema: isRecord(schema) ? schema : {},
      name,
    });
  }
  return read;
};

/** The text of a `tools/call` result, or null when the server did not answer content the adapter can read. */
const textOf = (result: unknown): string | null => {
  const content = fieldOf(result, "content");
  if (!Array.isArray(content)) return null;
  let text = "";
  for (const block of content) {
    const blockText = textFieldOf(block, "text");
    if (textFieldOf(block, "type") === "text" && blockText !== null) text += blockText;
  }
  return text;
};

/** One HTTP connector's server: sends Streamable-HTTP MCP requests with optional session handshake and redacted answers. */
export const httpMcpBackend = (
  transport: HttpTransport,
  options: { readonly requestTimeoutMillis?: number } = {},
): ConnectorBackend => {
  let counter = 0;
  let sessionId: string | null = null;
  let isInitialized = false;
  const shouldUseSession = transport.shouldUseSession === true || transport.oauth !== undefined;
  const timeoutMillis = options.requestTimeoutMillis ?? 60_000;

  /** Performs the MCP Streamable HTTP session handshake when required by the transport. */
  const ensureSession = Effect.fnUntraced(function* (secret: string | null) {
    if (!shouldUseSession || isInitialized) return;
    counter += 1;
    const initialized = yield* ask(
      transport,
      "initialize",
      { capabilities: {}, clientInfo, protocolVersion },
      secret,
      null,
      counter,
      timeoutMillis,
    );
    const initError = fieldOf(initialized.message, "error");
    if (initError !== void 0) return yield* Effect.fail(refuse("Failed"));
    sessionId = initialized.sessionId;
    yield* notify(transport, "notifications/initialized", secret, sessionId, timeoutMillis);
    isInitialized = true;
  });

  const sendRequest = Effect.fnUntraced(function* (method: string, params: unknown, secret: string | null) {
    yield* ensureSession(secret);
    counter += 1;
    const reply = yield* ask(transport, method, params, secret, sessionId, counter, timeoutMillis);
    if (reply.sessionId !== null) sessionId = reply.sessionId;
    const error = fieldOf(reply.message, "error");
    if (error !== void 0)
      return yield* Effect.fail(refuse(numberFieldOf(error, "code") === -32602 ? "InvalidArguments" : "Failed"));
    return fieldOf(reply.message, "result");
  });

  const askServer = (method: string, params: unknown, secret: string | null) =>
    sendRequest(method, params, secret).pipe(
      Effect.catch((failure) => {
        if (shouldUseSession && failure.upstream === sessionExpiredWords) {
          sessionId = null;
          isInitialized = false;
          return sendRequest(method, params, secret);
        }
        return Effect.fail(failure);
      }),
    );

  return {
    call: (tool, args, secret) =>
      askServer("tools/call", { arguments: args, name: tool }, secret).pipe(
        Effect.flatMap((result) => {
          const text = textOf(result);
          return fieldOf(result, "isError") === true || text === null
            ? Effect.fail(refuse("Failed"))
            : // The key's spellings leave with the answer removed, as the gateway removes them again behind this.
              Effect.succeed(redactedOf(text, secret === null ? [] : [secret]));
        }),
      ),
    close: Effect.sync(() => {
      sessionId = null;
      isInitialized = false;
    }),
    listTools: (secret) =>
      askServer("tools/list", {}, secret).pipe(
        Effect.flatMap((result) => {
          const tools = toolsOf(result);
          return tools === null ? Effect.fail(refuse("Failed")) : Effect.succeed(tools);
        }),
      ),
  };
};
