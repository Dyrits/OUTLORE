import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { Clock, Config, Effect, Fiber, Option, Queue, Ref, Semaphore } from "effect";
import {
  fieldOf,
  type HarnessFailure,
  isRecord,
  type RpcProcess,
  reducedEnvironmentOf,
  startRpcProcess,
  textFieldOf,
} from "../../core/index.ts";
import { isApplePermissionDenied } from "../applePermission.ts";
import { BackendFailure, type BackendTool, type ConnectorBackend } from "../backend.ts";

// The stdio MCP adapter (connectors blueprint, Backends): a child of the host speaking MCP over its standard
// streams, built on the shared line transport (core/lineProcess.ts). The child starts on first use, is closed when
// it has been idle a while, and is started again after a failure. It is given no secret — a stdio entry's secretKind
// stays null, and the `secret` of a call is never passed on — and an environment reduced to what it needs, so
// Outlore's own variables (the owner token) never reach it. The child runs in its own process group, and closing ends
// its whole tree.

/** The protocol revision this client opens with; a server that is older negotiates down from it. */
const protocolVersion = "2025-11-25";

/** Options for one stdio MCP server. */
export type StdioMcpOptions = {
  readonly hasAppleAutomation?: boolean;
  /** The command that runs the server, such as a system Node and the vendored server file. */
  readonly command: ReadonlyArray<string>;
  /** Extra environment for the child, on top of the reduced environment. */
  readonly env?: Record<string, string>;
  /** How long without a request the child is closed; the default is a minute. */
  readonly idleCloseMillis?: number;
  /** The server's name as the owner reads it, for failures. */
  readonly label: string;
  /** How long one request may take before the child is closed and the call fails; the default is a minute. */
  readonly requestTimeoutMillis?: number;
};

/** The system Node that runs a vendored server: the first of the usual locations that exists, else `node` on the PATH. */
export const systemNodePathOf = (): string => {
  for (const candidate of ["/usr/bin/node", "/usr/local/bin/node", "/opt/homebrew/bin/node"]) {
    if (existsSync(candidate)) return candidate;
  }
  return "node";
};

/**
 * The file a vendored server package runs from: the copy bundled into the packaged app (the desktop app passes its
 * vendor folder in `OUTLORE_VENDOR_DIR`), or the copy vendored with the service (`packages/service/vendor/`) in dev
 * and tests — this module lives at `src/connectors/backends/`, three levels below the package root.
 */
export const vendoredServerFileOf = Effect.fnUntraced(function* (server: string) {
  const packaged = yield* Config.String("OUTLORE_VENDOR_DIR").pipe(Config.option, Effect.orDie);
  if (Option.isSome(packaged)) return join(packaged.value, `${server}.cjs`);
  return join(import.meta.dirname, "..", "..", "..", "vendor", `${server}.cjs`);
});

/** The command a catalog entry's stdio server runs as: a system Node and the vendored file. */
export const stdioCommandOf = Effect.fnUntraced(function* (server: string) {
  return [systemNodePathOf(), yield* vendoredServerFileOf(server)];
});

/** The JSON-RPC error codes of a malformed call: the method does not exist, or the params do not fit the schema. */
const isInvalidArgumentsCode = (code: number | undefined) => code === -32601 || code === -32602;

/** Maps a transport failure to the backend's public class; the server's own words stay in `upstream`, for no one. */
const failureOf = (failure: HarnessFailure, label: string): BackendFailure =>
  new BackendFailure({
    class: isInvalidArgumentsCode(failure.code) ? "InvalidArguments" : "Unreachable",
    upstream: failure.reason || `${label} could not be reached.`,
  });

/** The text of a `tools/call` answer: its content blocks joined, which is the tool's answer as the catalog reads it. */
const answerTextOf = (result: unknown): string => {
  const content = fieldOf(result, "content");
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => textFieldOf(block, "text") ?? "")
    .filter((text) => text.length > 0)
    .join("\n");
};

/** Whether a `tools/call` answer is the tool's own error rather than its answer. */
const isErrorAnswerOf = (result: unknown) => fieldOf(result, "isError") === true;

/** One running child with the fiber that answers any request the server sends back. */
type RunningChild = {
  readonly drain: Fiber.Fiber<void, never>;
  readonly rpc: RpcProcess;
};

/**
 * One stdio MCP server as a connector backend, started on first use. The idle watcher this starts runs until the
 * backend's `close`.
 */
export const stdioMcpBackend = Effect.fnUntraced(function* (options: StdioMcpOptions) {
  // The release the desktop app runs, which a server may log; "dev" when run from source.
  const release = yield* Config.String("OUTLORE_RELEASE").pipe(Config.withDefault("dev"), Effect.orDie);
  const idleCloseMillis = options.idleCloseMillis ?? 60_000;
  const requestTimeoutMillis = options.requestTimeoutMillis ?? 60_000;
  const childRef = yield* Ref.make<RunningChild | null>(null);
  const lastUsedRef = yield* Ref.make(0);
  const childLock = yield* Semaphore.make(1);

  /** Ends the child if it is running and forgets it, so the next request starts a new one. */
  const endChild: Effect.Effect<void> = Effect.gen(function* () {
    const current = yield* Ref.get(childRef);
    if (current === null) return;
    yield* Ref.set(childRef, null);
    yield* Fiber.interrupt(current.drain);
    current.rpc.close();
  });

  /** Starts the child and performs the MCP opening exchange; a refusal ends it again and fails as Unreachable. */
  const startChild: Effect.Effect<RpcProcess, BackendFailure | HarnessFailure> = Effect.uninterruptibleMask((restore) =>
    Effect.gen(function* () {
      yield* endChild;
      const script = options.command[1];
      const rpc = yield* startRpcProcess({
        args: [...options.command.slice(1)],
        command: options.command[0] ?? "node",
        cwd: script !== undefined && existsSync(script) ? dirname(script) : process.cwd(),
        env: reducedEnvironmentOf(options.env ?? {}),
        isJsonRpc2: true,
        isTreeKilled: true,
        label: options.label,
      });
      // The server may ask us things (sampling, roots); answer every request with an error so it never waits on us.
      const drain = yield* Effect.forkDetach(
        Effect.gen(function* () {
          while (!rpc.hasExited()) {
            const item = yield* Queue.take(rpc.incoming);
            if (item._tag === "Exit") return;
            if (item._tag === "Request")
              rpc.respondError(item.id, "Outlore does not answer a connector server's requests.");
          }
        }),
      );
      let transferred = false;
      return yield* Effect.gen(function* () {
        const opened = yield* restore(
          rpc
            .request("initialize", {
              capabilities: {},
              clientInfo: { name: "Outlore", version: release },
              protocolVersion,
            })
            .pipe(Effect.timeoutOption(requestTimeoutMillis)),
        );
        if (Option.isNone(opened))
          return yield* new BackendFailure({
            class: "Unreachable",
            upstream: `${options.label} did not answer its opening exchange.`,
          });
        rpc.notify("notifications/initialized", {});
        yield* Ref.set(childRef, { drain, rpc });
        transferred = true;
        return rpc;
      }).pipe(
        Effect.ensuring(
          Effect.gen(function* () {
            if (transferred) return;
            yield* Fiber.interrupt(drain);
            rpc.close();
          }),
        ),
      );
    }),
  );

  /** The running child, started when there is none or it has exited. */
  const child: Effect.Effect<RpcProcess, BackendFailure | HarnessFailure> = childLock.withPermit(
    Effect.gen(function* () {
      const current = yield* Ref.get(childRef);
      const rpc = current !== null && !current.rpc.hasExited() ? current.rpc : yield* startChild;
      yield* Ref.set(lastUsedRef, yield* Clock.currentTimeMillis);
      return rpc;
    }),
  );

  /** One request to the server, timing out and ending the child so the next request starts a fresh one. */
  const request = Effect.fnUntraced(function* (method: string, params: unknown) {
    const rpc = yield* child;
    const answer = yield* rpc.request(method, params).pipe(Effect.timeoutOption(requestTimeoutMillis));
    if (Option.isNone(answer)) {
      yield* childLock.withPermit(
        Effect.gen(function* () {
          if ((yield* Ref.get(childRef))?.rpc === rpc) yield* endChild;
        }),
      );
      return yield* new BackendFailure({
        class: "Unreachable",
        upstream: `${options.label} did not answer ${method} within ${requestTimeoutMillis} ms.`,
      });
    }
    return answer.value;
  });

  /** Closes the child once it has been idle long enough; runs until `close` interrupts it. */
  const watcher = yield* Effect.forkDetach(
    Effect.forever(
      Effect.gen(function* () {
        yield* Effect.sleep(idleCloseMillis);
        yield* childLock.withPermit(
          Effect.gen(function* () {
            const lastUsed = yield* Ref.get(lastUsedRef);
            const now = yield* Clock.currentTimeMillis;
            if (now - lastUsed >= idleCloseMillis) yield* endChild;
          }),
        );
      }),
    ),
  );

  /** Ends any failure the transport reported in the backend's own class. */
  const classified = <A, R>(effect: Effect.Effect<A, BackendFailure | HarnessFailure, R>) =>
    effect.pipe(
      Effect.catch((failure) =>
        Effect.fail(failure._tag === "BackendFailure" ? failure : failureOf(failure, options.label)),
      ),
    );

  const backend: ConnectorBackend = {
    // The secret a call carries is never given to a stdio child: it is not read here.
    call: (tool, args) =>
      classified(
        request("tools/call", { arguments: args, name: tool }).pipe(
          Effect.filterOrFail(
            (result) => !isErrorAnswerOf(result),
            (result) => {
              const text = answerTextOf(result);
              if (options.hasAppleAutomation && isApplePermissionDenied(text))
                return new BackendFailure({
                  class: "Disconnected",
                  upstream: "macOS refused Automation permission.",
                });
              return new BackendFailure({
                class: "Failed",
                upstream: text || `${options.label} refused the call.`,
              });
            },
          ),
          Effect.map(answerTextOf),
        ),
      ),
    close: Effect.gen(function* () {
      yield* Fiber.interrupt(watcher);
      yield* childLock.withPermit(endChild);
    }),
    listTools: () =>
      classified(
        request("tools/list", {}).pipe(
          Effect.map((result): ReadonlyArray<BackendTool> => {
            const tools = fieldOf(result, "tools");
            if (!Array.isArray(tools)) return [];
            return tools.map((tool): BackendTool => {
              const schema = fieldOf(tool, "inputSchema");
              return {
                description: textFieldOf(tool, "description") ?? "",
                inputSchema: isRecord(schema) ? schema : {},
                name: String(fieldOf(tool, "name") ?? ""),
              };
            });
          }),
        ),
      ),
  };
  return backend;
});
