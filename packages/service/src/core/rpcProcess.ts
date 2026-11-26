import { Deferred, Effect, Queue } from "effect";
import { HarnessFailure } from "./executionTypes.ts";
import { type LineProcessOptions, spawnLineProcess } from "./lineProcess.ts";
import { fieldOf, numberFieldOf, textFieldOf } from "./records.ts";

/** What a JSON-RPC process sends that is not an answer to one of ours: a notification, a request, or its end. */
export type RpcIncoming =
  | { readonly _tag: "Notification"; readonly method: string; readonly params: unknown }
  | { readonly _tag: "Request"; readonly id: number | string; readonly method: string; readonly params: unknown }
  | { readonly _tag: "Exit"; readonly reason: string };

/** How to start a child that speaks JSON-RPC over its standard streams. */
export type RpcOptions = LineProcessOptions & {
  /** Whether messages carry `"jsonrpc": "2.0"`, which ACP requires and Codex's app server leaves out. */
  readonly isJsonRpc2: boolean;
};

/** One running child process and its JSON-RPC exchange. */
export interface RpcProcess {
  /** Ends the process; its pending requests fail. */
  readonly close: () => void;
  readonly hasExited: () => boolean;
  readonly incoming: Queue.Queue<RpcIncoming>;
  readonly notify: (method: string, params: unknown) => void;
  /** The process's id, or null when it did not start: the root of the tree whose containment is checked. */
  readonly pid: number | null;
  /** Sends a request and waits for its result; an error answer or the process's end fails it. */
  readonly request: (method: string, params: unknown) => Effect.Effect<unknown, HarnessFailure>;
  readonly respond: (id: number | string, result: unknown) => void;
  readonly respondError: (id: number | string, message: string) => void;
}

/** Starts a JSON-RPC process. */
export const startRpcProcess = Effect.fnUntraced(function* (options: RpcOptions) {
  const incoming = yield* Queue.unbounded<RpcIncoming>();
  const pending = new Map<number | string, Deferred.Deferred<unknown, HarnessFailure>>();
  let nextId = 1;

  const answer = (id: number | string, message: unknown) => {
    const deferred = pending.get(id);
    pending.delete(id);
    if (deferred === undefined) return;
    const error = fieldOf(message, "error");
    Deferred.doneUnsafe(
      deferred,
      error === undefined
        ? Effect.succeed(fieldOf(message, "result") ?? null)
        : Effect.fail(
            new HarnessFailure({
              // 0 reads as no code: JSON-RPC error codes are negative.
              code: numberFieldOf(error, "code") || void 0,
              reason: textFieldOf(error, "message") ?? `${options.label} refused a request.`,
            }),
          ),
    );
  };
  const child = spawnLineProcess(options, {
    onExit: (reason) => {
      for (const deferred of pending.values())
        Deferred.doneUnsafe(deferred, Effect.fail(new HarnessFailure({ reason })));
      pending.clear();
      Queue.offerUnsafe(incoming, { _tag: "Exit", reason });
    },
    onMessage: (message) => {
      const id = fieldOf(message, "id");
      const method = textFieldOf(message, "method");
      const params = fieldOf(message, "params");
      const isId = typeof id === "number" || typeof id === "string";
      if (method !== null && isId) Queue.offerUnsafe(incoming, { _tag: "Request", id, method, params });
      else if (method !== null) Queue.offerUnsafe(incoming, { _tag: "Notification", method, params });
      else if (isId) answer(id, message);
    },
  });
  const write = (message: object) => child.write(options.isJsonRpc2 ? { jsonrpc: "2.0", ...message } : message);

  const request = Effect.fnUntraced(function* (method: string, params: unknown) {
    if (child.hasExited()) return yield* new HarnessFailure({ reason: `${options.label} is not running.` });
    const id = nextId++;
    const deferred = yield* Deferred.make<unknown, HarnessFailure>();
    pending.set(id, deferred);
    write({ id, method, params });
    return yield* Deferred.await(deferred);
  });

  return {
    close: child.close,
    hasExited: child.hasExited,
    incoming,
    notify: (method, params) => write({ method, params }),
    pid: child.pid,
    request,
    respond: (id, result) => write({ id, result }),
    respondError: (id, message) => write({ error: { code: -32601, message }, id }),
  } satisfies RpcProcess;
});
