import { Effect, Layer } from "effect";
import { fieldOf, numberFieldOf, textFieldOf } from "../../core/index.ts";
import {
  BackendFailure,
  type BackendTool,
  type ConnectorBackend,
  ConnectorBackends,
  type ConnectorErrorClass,
} from "../backend.ts";
import type { CatalogBackend } from "../catalog.ts";
import { redactedOf } from "../connectorErrors.ts";

// A Streamable-HTTP MCP client (connectors blueprint, Backends): one POST per request, no session kept, the
// connector's key in the one header its catalog entry names, and a failure carrying the backend's own fixed words,
// since an upstream's text may echo the key. Whether `connect.composio.dev/mcp` answers `tools/list` without a prior
// `initialize` is not checked against the real server (no key); if it refuses, the fallback is one `initialize`
// request when the backend opens (specification, Composio; CHG-0532).

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

/** The failure with the class's own fixed words: nothing a server said reaches it. */
const refuse = (errorClass: ConnectorErrorClass) =>
  new BackendFailure({ class: errorClass, upstream: failureWordsOf[errorClass] });

/** The class of failure an HTTP status is. */
const failureClassOf = (status: number): ConnectorErrorClass =>
  status === 401 || status === 403 ? "Disconnected" : status === 429 || status >= 500 ? "Unreachable" : "Failed";

/** The JSON-RPC message an answer body carried, or null when the body held none the adapter can use. */
const messageOf = (body: string, contentType: string) => {
  const frames = contentType.includes("text/event-stream")
    ? body.split("\n\n").flatMap((frame) =>
        frame
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice("data: ".length)),
      )
    : [body];
  for (const frame of frames) {
    // A body no frame of answers as JSON is the server's failure, not a network one, so it never reaches the catch.
    try {
      const parsed: unknown = JSON.parse(frame);
      if (isRecord(parsed)) return parsed;
    } catch {}
  }
  return null;
};

/** Whether a value from a server is a record of its fields, not an array or a plain string. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** One request to the server: its JSON-RPC answer message, or the transport's failure. */
const ask = (transport: HttpTransport, method: string, params: unknown, secret: string | null, counter: number) =>
  Effect.tryPromise({
    catch: (problem) => (problem instanceof HttpRefusal ? problem.failure : refuse("Unreachable")),
    try: (signal) =>
      fetch(transport.url, {
        body: JSON.stringify({ id: counter, jsonrpc: "2.0", method, params }),
        headers: {
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
          "mcp-protocol-version": protocolVersion,
          ...(secret === null ? {} : { [transport.header]: secret }),
        },
        method: "POST",
        signal,
      }).then(async (response) => {
        if (response.status < 200 || response.status >= 300) throw new HttpRefusal(failureClassOf(response.status));
        // A 2xx answer with no JSON-RPC message in it is the server's failure, not a network one.
        const message = messageOf(await response.text(), response.headers.get("content-type") ?? "");
        if (message === null) throw new HttpRefusal("Failed");
        return message;
      }),
  });

/** The failure of a request the transport itself reported, kept out of the catch-all that a network error shares. */
class HttpRefusal extends Error {
  readonly failure: BackendFailure;

  constructor(errorClass: ConnectorErrorClass) {
    super(failureWordsOf[errorClass]);
    this.failure = refuse(errorClass);
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
export const httpMcpBackend = (transport: HttpTransport): ConnectorBackend => {
  let counter = 0;
  // One request per list or call: the server decides nothing about the next request, so nothing is cached here.
  const askServer = (method: string, params: unknown, secret: string | null) =>
    Effect.gen(function* () {
      counter += 1;
      const message = yield* ask(transport, method, params, secret, counter);
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

/** A connector's server for which no adapter is built, so every request honestly cannot reach it. */
const unbuiltBackend = (upstream: string): ConnectorBackend => ({
  call: () => Effect.fail(new BackendFailure({ class: "Unreachable", upstream })),
  close: Effect.void,
  listTools: () => Effect.fail(new BackendFailure({ class: "Unreachable", upstream })),
});

/** The service's backends: an HTTP entry opens the Streamable-HTTP adapter; the stdio one comes with blueprint step 4's second half. */
export const connectorBackendsLayer = Layer.succeed(ConnectorBackends, {
  open: (entry) =>
    Effect.succeed(
      entry.backend._tag === "Http"
        ? httpMcpBackend(entry.backend)
        : // The Apple apps entry's stdio server is the stdio adapter's to build (blueprint step 4, second half).
          unbuiltBackend("No stdio backend is built for this connector yet."),
    ),
});
