import { Effect } from "effect";
import { isRecord } from "../../core/index.ts";
import { BackendFailure, type ConnectorErrorClass } from "../backend.ts";
import type { CatalogBackend } from "../catalog.ts";

// Wire transport for Streamable-HTTP MCP requests: POST framing, SSE reply reading, redirect refusal, and error classification.

/** The HTTP transport of one catalog entry. */
export type HttpTransport = Extract<CatalogBackend, { readonly _tag: "Http" }>;

/** The version of MCP this adapter speaks, told to the server with every request, as Streamable HTTP asks. */
export const protocolVersion = "2025-06-18";

/** Client identity sent during MCP Streamable HTTP session initialization. */
export const clientInfo = { name: "outlore", version: "0.2.7" } as const;

/** Fixed words used when a server reports 404 for a stale MCP session identifier. */
export const sessionExpiredWords = "The server expired the MCP session.";

/** The failure of each class, in words written here, never the server's own. */
const failureWordsOf = {
  Disconnected: "The server rejected the connector's sign-in.",
  Failed: "The server did not answer a message the adapter can use.",
  InvalidArguments: "The server did not accept the call's arguments.",
  Unreachable: "The server could not be reached.",
} as const satisfies Record<ConnectorErrorClass, string>;

/** The fixed words of a refused redirect, preventing credentials from crossing origins or schemes. */
const redirectWords = "The server redirected the request elsewhere, which the adapter does not follow.";

/** The failure with the class's own fixed words: nothing a server said reaches it. */
export const refuse = (errorClass: ConnectorErrorClass) =>
  new BackendFailure({ class: errorClass, upstream: failureWordsOf[errorClass] });

/** The class of failure an HTTP status is. */
const failureClassOf = (status: number): ConnectorErrorClass =>
  status === 401 || status === 403 ? "Disconnected" : status === 429 || status >= 500 ? "Unreachable" : "Failed";

/** The failure of a request the transport itself reported, kept out of the catch-all that a network error shares. */
class HttpRefusal extends Error {
  readonly failure: BackendFailure;
  readonly isSessionExpired: boolean;

  constructor(
    errorClass: ConnectorErrorClass,
    words: string = failureWordsOf[errorClass],
    isSessionExpired: boolean = false,
  ) {
    super(words);
    this.failure = new BackendFailure({ class: errorClass, upstream: words });
    this.isSessionExpired = isSessionExpired;
  }
}

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

/** Headers sent with one Streamable-HTTP MCP request, including the credential and session identifier when present. */
const headersOf = (transport: HttpTransport, secret: string | null, sessionId: string | null) => ({
  accept: "application/json, text/event-stream",
  "content-type": "application/json",
  "mcp-protocol-version": protocolVersion,
  ...(sessionId === null ? {} : { "mcp-session-id": sessionId }),
  ...(secret === null || transport.header === null ? {} : { [transport.header]: `${transport.prefix ?? ""}${secret}` }),
});

/** One JSON-RPC request to the server: its answer message and any session header, or the transport's failure. */
export const ask = (
  transport: HttpTransport,
  method: string,
  params: unknown,
  secret: string | null,
  sessionId: string | null,
  counter: number,
  timeoutMillis: number,
) =>
  Effect.tryPromise({
    catch: (problem) => (problem instanceof HttpRefusal ? problem.failure : refuse("Unreachable")),
    try: (signal) =>
      fetch(transport.url, {
        body: JSON.stringify({ id: counter, jsonrpc: "2.0", method, params }),
        headers: headersOf(transport, secret, sessionId),
        // Never followed: a redirect would send the key's header to whatever origin the server names.
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
      }).then(async (response) => {
        // A manual redirect answers with its 3xx status, or as an opaque redirect of status 0; either way the key stops here.
        if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400))
          throw new HttpRefusal("Failed", redirectWords);
        if (response.status === 404 && sessionId !== null) throw new HttpRefusal("Failed", sessionExpiredWords, true);
        if (response.status < 200 || response.status >= 300) throw new HttpRefusal(failureClassOf(response.status));
        // A 2xx answer with no JSON-RPC message in it is the server's failure, not a network one.
        const message = (response.headers.get("content-type") ?? "").includes("text/event-stream")
          ? await readEventReply(response, counter)
          : messageOf(await response.text(), counter);
        if (message === null) throw new HttpRefusal("Failed");
        return { message, sessionId: response.headers.get("mcp-session-id") };
      }),
  });

/** Sends one JSON-RPC notification (such as `notifications/initialized`) without expecting a JSON-RPC reply body. */
export const notify = (
  transport: HttpTransport,
  method: string,
  secret: string | null,
  sessionId: string | null,
  timeoutMillis: number,
) =>
  Effect.tryPromise({
    catch: (problem) => (problem instanceof HttpRefusal ? problem.failure : refuse("Unreachable")),
    try: (signal) =>
      fetch(transport.url, {
        body: JSON.stringify({ jsonrpc: "2.0", method }),
        headers: headersOf(transport, secret, sessionId),
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(timeoutMillis)]),
      }).then((response) => {
        if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400))
          throw new HttpRefusal("Failed", redirectWords);
        if (response.status < 200 || response.status >= 300) throw new HttpRefusal(failureClassOf(response.status));
      }),
  });
