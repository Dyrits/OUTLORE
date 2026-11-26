import type { BillingKind, TokenUsage } from "@outlore/contracts";
import { Deferred, type Duration, Effect } from "effect";
import type { HarnessFailure, SteeredMessage, TurnRequest } from "../core/index.ts";

/** A thread's running harness process, as its protocol opened it. */
export interface HarnessConnection {
  readonly close: () => void;
  /** Whether the process woke itself and no turn has taken that work in yet; left out, it never wakes itself. */
  readonly hasBackgroundWake?: () => boolean;
  /** Whether the process still runs work in the background that will wake it when it ends; left out, it never does. */
  readonly hasBackgroundWork?: () => boolean;
  readonly hasExited: () => boolean;
  /** The harness's own conversation, which the thread's next turn continues. */
  readonly sessionId: string;
}

/** The pool's side of a running turn, which the protocol reads and reports to. */
export interface PooledTurn {
  /** Reports that the harness took in a steered message; a message not steered into this turn is ignored. */
  readonly deliver: (messageId: string) => Effect.Effect<void>;
  /** Runs work beside the turn, such as answering one of the harness's own requests; its failure ends the turn. */
  readonly fork: (work: Effect.Effect<void, HarnessFailure>) => Effect.Effect<void>;
  /** Whether the turn is being interrupted: an end the harness reports now counts as interrupted. */
  readonly isInterrupting: () => boolean;
  /** Records the usage reported so far, kept when an interrupt the harness never confirms ends the turn. */
  readonly reportUsage: (usage: TokenUsage | null) => void;
}

/** How a turn ended, as the harness reported it. */
export type TurnEnd = {
  /** How the turn was billed, when the harness reports its sign-in; absent counts as Unknown. */
  readonly billing?: BillingKind;
  /** What the thread's context held after the turn's latest model call; absent or null when unreported. */
  readonly context?: number | null;
  /** The context window the harness reported for the turn's model; absent or null when it reported none. */
  readonly contextWindow?: number | null;
  /** The turn's own cost in dollars when the harness reported one; absent or null counts its tokens. */
  readonly cost?: number | null;
  readonly isInterrupted: boolean;
  readonly usage: TokenUsage | null;
};

/** What a process tells the pool on its own. */
export interface ProcessSignals {
  /** The process may have woken itself: the pool checks `hasBackgroundWake` and, if no turn runs, asks for a turn. */
  readonly resume: () => void;
}

/** What one harness's protocol does with a process the pool keeps. */
export interface HarnessProtocol<Connection extends HarnessConnection> {
  /** Asks the harness to end the running turn; false when the turn cannot be interrupted yet. */
  readonly interrupt: (connection: Connection) => Effect.Effect<boolean>;
  /** Everything the process starts with that a turn may change; a changed key restarts the process while continuing its conversation. */
  readonly restartKeyOf: (request: TurnRequest) => string;
  /** Runs one turn on the process, reporting its events, until the harness ends it. */
  readonly runTurn: (
    connection: Connection,
    request: TurnRequest,
    turn: PooledTurn,
  ) => Effect.Effect<TurnEnd, HarnessFailure>;
  /** Starts the thread's process and opens or continues its conversation; a failure leaves no process. */
  readonly start: (request: TurnRequest, signals: ProcessSignals) => Effect.Effect<Connection, HarnessFailure>;
  /** Writes a message into the running turn; false when the harness did not take it or takes none mid-turn. */
  readonly steer: (connection: Connection, message: SteeredMessage) => Effect.Effect<boolean>;
}

/** How long the pool keeps processes. */
export type PoolOptions = {
  /** How long a thread whose process still runs background work keeps it; one hour by default. */
  readonly backgroundHold?: Duration.Input;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** How long a harness has to end an interrupted turn; `interruptGraceMillis` by default. */
  readonly interruptGrace?: Duration.Input;
};

/** The pool's internal state for a turn currently executing on a kept process. */
export type RunningTurn = {
  readonly failed: Deferred.Deferred<never, HarnessFailure>;
  readonly interrupted: Deferred.Deferred<void>;
  isInterrupting: boolean;
  readonly onEvent: TurnRequest["onEvent"];
  /** Messages steered into the turn that the harness has not taken in yet. */
  readonly untaken: Set<string>;
  usage: TokenUsage | null;
};

/** One kept process entry in the pool, with its idle timer and active or settling turn. */
export type ProcessEntry<Connection> = {
  readonly connection: Connection;
  idleTimer: ReturnType<typeof setTimeout> | null;
  /** Whether a turn was asked for to take in what the process began on its own, until a turn begins on it. */
  isTakingBackgroundWake: boolean;
  readonly key: string;
  settling: RunningTurn | null;
  turn: RunningTurn | null;
};

/** Builds the `PooledTurn` control surface passed to a harness protocol for one running turn. */
export const pooledTurnControlOf = (turn: RunningTurn): PooledTurn => ({
  deliver: (messageId) =>
    Effect.suspend(() =>
      turn.untaken.delete(messageId) ? turn.onEvent({ _tag: "Delivered", messageId }) : Effect.void,
    ),
  fork: (work) =>
    Effect.forkChild(work.pipe(Effect.catch((failure) => Deferred.fail(turn.failed, failure)))).pipe(Effect.asVoid),
  isInterrupting: () => turn.isInterrupting,
  reportUsage: (usage) => {
    turn.usage = usage;
  },
});
