import { Context, type Effect } from "effect";

// The two things the gateway needs from `work/`, which it does not import (connectors blueprint, Shape): asking the owner about a call, and putting a warning line in a thread. `work/` supplies both.

/** One call that needs the owner's answer, in the catalog's words; never in words a server gave. */
export type ToolUse = {
  readonly connector: string;
  /** The arguments as the thread gave them, for the owner to read on request. */
  readonly details: string;
  /** One sentence in plain words: what the call would do, and to which connector. */
  readonly summary: string;
  /** The tool's exact name at its server: with the connector, the standing permission's identity. */
  readonly tool: string;
};

/** The owner's answer to a call. */
export type ToolUseDecision = {
  readonly isAllowed: boolean;
  /** Told to the thread: the refusal, or how to proceed. */
  readonly text: string;
};

/** Asks the owner about one call: Allow, Always allow or Deny, the thread waiting in Attention with no time limit. */
export class ConnectorAsking extends Context.Service<
  ConnectorAsking,
  {
    readonly askToolUse: (threadId: string, use: ToolUse) => Effect.Effect<ToolUseDecision>;
  }
>()("outlore/connectors/ConnectorAsking") {}

/** Puts a warning line in a thread's conversation: a connector failed and the turn goes on without it. */
export class ConnectorNotices extends Context.Service<
  ConnectorNotices,
  {
    readonly warn: (threadId: string, text: string) => Effect.Effect<void>;
  }
>()("outlore/connectors/ConnectorNotices") {}
