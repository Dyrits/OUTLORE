import { Effect } from "effect";
import { fieldOf, isRecord, numberFieldOf, textFieldOf } from "../../core/index.ts";
import { BackendFailure, type BackendTool, type ConnectorBackend, type ConnectorErrorClass } from "../backend.ts";
import type { CatalogBackend } from "../catalog.ts";
import { redactedOf } from "../connectorErrors.ts";

// A Streamable-HTTP MCP client (connectors blueprint, Backends): one POST per request, no session kept, the
// connector's key in the one header its catalog entry names (after the entry's prefix, such as "Bearer ", if it has
// one; a keyless entry names no header and sends none), and a failure carrying the backend's own fixed words,
// since an upstream's text may echo the key. Redirects are never followed, so the key's header cannot be carried to
// another origin. Whether `connect.composio.dev/mcp` answers `tools/list` without a prior `initialize` is not
// checked against the real server (no key); if it refuses, the fallback is one `initialize` request when the
// backend opens (specification, Composio; CHG-0540).

/** The HTTP transport of one catalog entry. */
type HttpTransport = Extract<CatalogBackend, { readonly _tag: "Http" }>;

/** The version of MCP this adapter speaks, told to the server with every request, as Streamable HTTP asks. */
const protocolVersion = "2025-06-18";

/** The failure of each class, in words written here, never the server's own. */
const failureWordsOf = {
  Disconnected: "The server rejected the connector's sign-in.",
  Failed: "The server did not answer a message the adapter can use.",
  InvalidArguments: "The server did not accept the call's arguments.",
  Unreachable: "The server could not be reached.",
} as const satisfies Record<ConnectorErrorClass, string>;

/**
 * The fixed words of a refused redirect: following one would carry the key's header to whoever the server (or
 * something between) names, including another origin or a plainer scheme, so no redirect is ever followed.
 */
const redirectWords = "The server redirected the request elsewhere, which the adapter does not follow.";

/** The failure with the class's own fixed words: nothing a server said reaches it. */
const refuse = (errorClass: ConnectorErrorClass) =>
  new BackendFailure({ class: errorClass, upstream: failureWordsOf[errorClass] });

/** The class of failure an HTTP status is. */
const failureClassOf = (status: number): ConnectorErrorClass =>
  status === 401 || status === 403 ? "Disconnected" : status === 429 || status >= 500 ? "Unreachable" : "Failed";

/** A matching JSON-RPC reply, excluding notifications and other requests on an event stream. */
const messageOf = (body: string, id: number) => {
  try {
    const parsed: unknown = JSON.parse(body);
    return isRecord(parsed) &&
      parsed.id === id &&
      !Object.hasOwn(parsed, "method") &&
      (Object.hasOwn(parsed, "result") || Object.hasOwn(parsed, "error"))
      ? parsed
      : null;
  } catch {
    return null;
  }
};

/** Read complete SSE events until this request's reply arrives, even when the server keeps the stream open. */
const readEventReply = async (response: Response, id: number) => {
  if (response.body === null) return null;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      let boundary = /\r?\n\r?\n/.exec(buffer);
      while (boundary !== null) {
        const frame = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = frame
          .split(/\r?\n/)
          .filter((line) => line === "data" || line.startsWith("data:"))
          .map((line) => line.slice(5).replace(/^ /, ""))
          .join("\n");
        const message = messageOf(data, id);
        if (message !== null) return message;
        boundary = /\r?\n\r?\n/.exec(buffer);
      }
      if (chunk.done) return null;
      if (buffer.length > 1_000_000) throw new HttpRefusal("Failed");
    }
  } finally {
    void reader.cancel().catch(() => undefined);
  }
};

/** One request to the server: its JSON-RPC answer message, or the transport's failure. */
const ask = (
  transport: HttpTransport,
  method: string,
  params: unknown,
  secret: string | null,
  counter: number,
  timeoutMillis: number,
) =>
  Effect.tryPromise({
    catch: (problem) => (problem instanceof HttpRefusal ? problem.failure : refuse("Unreachable")),
    try: (signal) =>
      fetch(transport.url, {
        body: JSON.stringify({ id: counter, jsonrpc: "2.0", method, params }),
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-protocol-version": protocolVersion,
          ...(secret === null || transport.header === null
            ? {}
            : { [transport.header]: `${transport.prefix ?? ""}${secret}` }),
        },
        // Never followed: a redirect would send the key's header to whatever origin the server names (a different
        // host, or a plainer scheme), so the adapter takes the answer itself and refuses it below.
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
      }).then(async (response) => {
        // A manual redirect answers with its 3xx status, or as an opaque redirect of status 0; either way the key stops here.
        if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400))
          throw new HttpRefusal("Failed", redirectWords);
        if (response.status < 200 || response.status >= 300) throw new HttpRefusal(failureClassOf(response.status));
        // A 2xx answer with no JSON-RPC message in it is the server's failure, not a network one.
        const message = (response.headers.get("content-type") ?? "").includes("text/event-stream")
          ? await readEventReply(response, counter)
          : messageOf(await response.text(), counter);
        if (message === null) throw new HttpRefusal("Failed");
        return message;
      }),
  });

/** The failure of a request the transport itself reported, kept out of the catch-all that a network error shares. */
class HttpRefusal extends Error {
  readonly failure: BackendFailure;

  constructor(errorClass: ConnectorErrorClass, words: string = failureWordsOf[errorClass]) {
    super(words);
    this.failure = new BackendFailure({ class: errorClass, upstream: words });
  }
}

/**
 * The tools of a `tools/list` result, or null when the server did not answer a list the adapter can read. Names the
 * catalog rejects stay for the gateway to drop (toolListing keeps only `isToolName`).
 */
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

/**
 * One HTTP connector's server: each request is one POST with the key in the entry's header, an interrupted or stopped
 * call gives up waiting, and the answer's text has the key's spellings redacted before it leaves.
 */
export const httpMcpBackend = (
  transport: HttpTransport,
  options: { readonly requestTimeoutMillis?: number } = {},
): ConnectorBackend => {
  let counter = 0;
  // One request per list or call: the server decides nothing about the next request, so nothing is cached here.
  const askServer = (method: string, params: unknown, secret: string | null) =>
    Effect.gen(function* () {
      counter += 1;
      const message = yield* ask(transport, method, params, secret, counter, options.requestTimeoutMillis ?? 60_000);
      const error = fieldOf(message, "error");
      if (error !== void 0)
        return yield* Effect.fail(refuse(numberFieldOf(error, "code") === -32602 ? "InvalidArguments" : "Failed"));
      return fieldOf(message, "result");
    });

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
    close: Effect.void,
    listTools: (secret) =>
      askServer("tools/list", {}, secret).pipe(
        Effect.flatMap((result) => {
          const tools = toolsOf(result);
          return tools === null ? Effect.fail(refuse("Failed")) : Effect.succeed(tools);
        }),
      ),
  };
};
