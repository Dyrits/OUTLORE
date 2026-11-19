import { Context, Deferred, Effect, Layer } from "effect";
import { newId } from "../core/index.ts";

// The calls underway and each thread's per-turn tool snapshot (connectors blueprint, Gateway, the timing contract). The
// blueprint keeps policy revisions to order a call against a switch; this keeps the same order with less: a switch narrows
// the snapshots of the threads it touches inside its own transaction, so a call that reads its snapshot after the
// switch was made finds the tool gone, and the calls underway are stopped once the transaction has committed.

/** One call underway. The `(connector, tool, thread)` tuple can name several at once, so each has its own identifier. */
export interface Invocation {
  readonly connector: string;
  readonly id: string;
  /** Whether the call has been handed to the connector's server: a stopped write then may already have happened. */
  readonly isDispatched: () => boolean;
  /** The name a thread lists and calls: `<connector>__<tool>`. */
  readonly listedName: string;
  readonly markDispatched: () => void;
  /** Completed when the call is stopped, by a switch. */
  readonly stopped: Deferred.Deferred<void>;
  readonly threadId: string;
}

/** What the registry keeps for the gateway: calls underway and each thread's snapshot of its tools for the turn. */
export class ConnectorCalls extends Context.Service<
  ConnectorCalls,
  {
    /** Forgets the thread's snapshot, as its turn ends. */
    readonly dropSnapshot: (threadId: string) => Effect.Effect<void>;
    /** Removes from every snapshot the listed names the check no longer offers its thread; never adds one. */
    readonly narrowSnapshots: (
      offeredTo: (threadId: string) => Effect.Effect<ReadonlySet<string>>,
    ) => Effect.Effect<void>;
    /** The thread's snapshot of its tools for the turn, or null before any turn took one. */
    readonly snapshotOf: (threadId: string) => ReadonlySet<string> | null;
    /** Stops every call underway whose listed name is no longer in its thread's snapshot; how many it stopped. */
    readonly stopRevoked: Effect.Effect<number>;
    /** Stops revoked calls except the call that just reported a revocation. */
    readonly stopRevokedExcept: (invocationId: string | null) => Effect.Effect<number>;
    /** Takes the thread's snapshot at a turn's start: exactly the names it is offered then. */
    readonly takeSnapshot: (threadId: string, names: ReadonlyArray<string>) => Effect.Effect<void>;
    /** Registers a call before anything about it is read, runs it, and forgets it however it ends. */
    readonly track: <A, E, R>(
      call: { readonly connector: string; readonly listedName: string; readonly threadId: string },
      use: (invocation: Invocation) => Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E, R>;
  }
>()("outlore/connectors/ConnectorCalls") {}

/** The registry, empty. */
export const connectorCallsLayer = Layer.sync(ConnectorCalls, () => {
  const underway = new Map<string, Invocation>();
  const snapshots = new Map<string, Set<string>>();

  const begin = (call: { readonly connector: string; readonly listedName: string; readonly threadId: string }) =>
    Effect.gen(function* () {
      const id = yield* newId;
      let isDispatched = false;
      const invocation: Invocation = {
        ...call,
        id,
        isDispatched: () => isDispatched,
        markDispatched: () => {
          isDispatched = true;
        },
        stopped: Deferred.makeUnsafe<void>(),
      };
      underway.set(id, invocation);
      return invocation;
    });

  const stopRevokedExcept = Effect.fnUntraced(function* (invocationId: string | null) {
    let count = 0;
    for (const invocation of [...underway.values()]) {
      if (invocation.id === invocationId || snapshots.get(invocation.threadId)?.has(invocation.listedName) === true)
        continue;
      if (yield* Deferred.succeed(invocation.stopped, void 0)) count++;
    }
    return count;
  });
  return {
    dropSnapshot: (threadId) => Effect.sync(() => void snapshots.delete(threadId)),
    narrowSnapshots: (offeredTo) =>
      Effect.gen(function* () {
        for (const [threadId, names] of [...snapshots]) {
          const offered = yield* offeredTo(threadId);
          for (const name of names) if (!offered.has(name)) names.delete(name);
        }
      }),
    snapshotOf: (threadId) => snapshots.get(threadId) ?? null,
    stopRevoked: stopRevokedExcept(null),
    stopRevokedExcept,
    takeSnapshot: (threadId, names) => Effect.sync(() => void snapshots.set(threadId, new Set(names))),
    track: (call, use) =>
      Effect.acquireUseRelease(begin(call), use, (invocation) =>
        Effect.sync(() => void underway.delete(invocation.id)),
      ),
  };
});
