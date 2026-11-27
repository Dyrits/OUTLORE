import { Effect, type Scope } from "effect";
import type { ConnectorGateway } from "../connectors/index.ts";
import type { Endpoints, Harness, SteeredMessage } from "../core/index.ts";
import type { Approvals } from "./approvals.ts";

// What one run holds while its turn is with the harness (thread-messaging, action-approval, connectors), opened and
// released together: a turn used to list each store it had touched in a cleanup of its own, and every store was keyed by
// the thread, so a second run on the thread would have cleared the first's one-time approvals, connector snapshot and
// interrupt route. A run is named by its key. The thread's main run is keyed by the thread's id, so everything that
// reads or acts by thread id (the tool server, steering, an interrupt) reaches it unchanged; a side run, such as a
// Companion answering one message beside the main turn (thread-messaging blueprint), has a key of its own and shares
// nothing but the thread with it.

/** A turn the harness is running, with the steered messages already written to it. */
export type ActiveTurn = {
  readonly turnId: string;
  readonly written: Set<string>;
};

type RunHeld = {
  readonly runKey: string;
  /** The names of the connector tools the run is offered for this turn, as its snapshot holds them. */
  readonly snapshot: ReadonlyArray<string>;
  readonly threadId: string;
  readonly turn: ActiveTurn;
};

/** The thread's main run: the only one that settles the thread's own state and session (work/lifecycle.ts). */
export type MainTurnScope = RunHeld & { readonly kind: "main" };

/** A run beside the thread's main turn, keyed apart from it; it never writes the thread's state or session. */
export type SideTurnScope = RunHeld & { readonly kind: "side" };

/** One run of a thread, from the start of its turn with the harness to its end. */
export type TurnScope = MainTurnScope | SideTurnScope;

/** What opening a scope needs: the thread and turn it runs, the setting its tools are listed under, and its key if it is a side run. */
export type OpenTurnScope = {
  readonly isUsingCodeMode: boolean;
  /** The key of a side run, which is no thread's id (name it for its thread, such as `<thread>#companion`); left out, the scope is the thread's main run. */
  readonly runKey?: string;
  readonly threadId: string;
  readonly turnId: string;
};

/** What the scopes hold state through: the stores a run's state lives in, and the harness steering and interrupts go to. */
export type TurnScopeDependencies = {
  readonly approvals: Pick<Approvals["Service"], "endTurn">;
  readonly connectorGateway: Pick<ConnectorGateway["Service"], "beginTurn" | "endTurn">;
  readonly endpoints: Pick<Endpoints["Service"], "holdCodeMode" | "releaseCodeMode">;
  readonly harness: Pick<Harness["Service"], "interrupt" | "steer">;
};

/** Makes the registry of open scopes over the stores they hold state in. */
export const makeTurnScopes = ({ approvals, connectorGateway, endpoints, harness }: TurnScopeDependencies) => {
  const open = new Map<string, TurnScope>();
  /** The thread's main scope: by thread id, so a side run is never found as the thread's own turn. */
  const mainOf = (threadId: string): MainTurnScope | null => {
    const scope = open.get(threadId);
    return scope?.kind === "main" ? scope : null;
  };

  /**
   * Opens a scope for the turn's run: the tool server answers under the setting the turn starts with, as its harness
   * lists the tools (CHG-0446); the connectors list their tools again, and the run's snapshot of the tools it is offered
   * for the turn is taken. One finalizer, run when the caller's `Scope` ends however the turn ends, releases what the
   * run held (what was allowed once in it is spent, action-approval CHG-0063) and no other run's.
   */
  const openScope = (request: OpenTurnScope): Effect.Effect<TurnScope, never, Scope.Scope> =>
    Effect.acquireRelease(
      Effect.gen(function* () {
        const { isUsingCodeMode, threadId, turnId } = request;
        const runKey = request.runKey ?? threadId;
        const turn: ActiveTurn = { turnId, written: new Set() };
        yield* endpoints.holdCodeMode(runKey, isUsingCodeMode);
        const snapshot = yield* connectorGateway.beginTurn(threadId, runKey);
        const held = { runKey, snapshot, threadId, turn };
        const scope: TurnScope = runKey === threadId ? { ...held, kind: "main" } : { ...held, kind: "side" };
        open.set(runKey, scope);
        return scope;
      }),
      (scope) =>
        Effect.gen(function* () {
          // Only if it is still the one registered: a later scope of the same key is not this one's to remove.
          if (open.get(scope.runKey) === scope) open.delete(scope.runKey);
          yield* approvals.endTurn(scope.runKey);
          yield* connectorGateway.endTurn(scope.runKey);
          // A thread's own setting stays for its kept harness process, which outlives the turn; a side run's ends with it.
          if (scope.kind === "side") yield* endpoints.releaseCodeMode(scope.runKey);
        }),
    );

  return {
    /** Ends the thread's running main turn, whose `runTurn` then returns as interrupted; false when none runs. */
    interrupt: (threadId: string) => {
      const scope = mainOf(threadId);
      return scope === null ? Effect.succeed(false) : harness.interrupt(scope.runKey);
    },
    /** Whether the thread has a main turn with the harness now. */
    isRunning: (threadId: string) => mainOf(threadId) !== null,
    /** The thread's main turn with the harness, or null. */
    mainTurnOf: (threadId: string): ActiveTurn | null => mainOf(threadId)?.turn ?? null,
    open: openScope,
    /** Writes a message into the thread's running main turn; false when none runs or the harness cannot take one mid-turn. */
    steer: (threadId: string, message: SteeredMessage) => {
      const scope = mainOf(threadId);
      return scope === null ? Effect.succeed(false) : harness.steer(scope.runKey, message);
    },
  };
};

/** The registry of open scopes a thread layer holds. */
export type TurnScopes = ReturnType<typeof makeTurnScopes>;
