import { Context, Effect, Layer } from "effect";
import { type ToolAnswer, unknownToolAnswer } from "../core/index.ts";

/** One tool of a connector as a thread is offered it: its listed name is `<connector>__<tool>` (connectors blueprint). */
export type ConnectorTool = {
  /** The connector's catalog id: letters, digits and underscore. */
  readonly connector: string;
  readonly description: string;
  /** The tool's JSON Schema for its arguments, as its server lists it. */
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** The name the thread lists and calls. */
  readonly name: string;
  /** The tool's own name at its server. */
  readonly tool: string;
};

/**
 * The connector gateway: the tools a thread may use, and the one door to call them, which asks the owner, stops a
 * switched-off call and keeps secrets out of answers (connectors specification and blueprint, `gateway.ts`).
 */
export class ConnectorGateway extends Context.Service<
  ConnectorGateway,
  {
    /**
     * A turn starts: the thread's connectors list their tools again, one that fails warns and is left out, and the
     * thread's snapshot of the tools it is offered for the turn is taken, kept under the run's key (the thread's id for
     * its main run). Answers the listed names in the snapshot.
     */
    readonly beginTurn: (threadId: string, runKey?: string) => Effect.Effect<ReadonlyArray<string>>;
    /** The run's turn ends: its snapshot is forgotten, and no other run's. */
    readonly endTurn: (runKey: string) => Effect.Effect<void>;
    /** The usable, switched-on connector tools of the thread, those its turn's snapshot holds. */
    readonly listingFor: (threadId: string) => Effect.Effect<ReadonlyArray<ConnectorTool>>;
    /** Calls one connector tool for the thread; a refusal or a failure is an error answer, never a failure. */
    readonly call: (threadId: string, name: string, args: unknown) => Effect.Effect<ToolAnswer>;
  }
>()("outlore/ConnectorGateway") {}

/**
 * A gateway that offers no tool, for a service built to test without connectors. The service's own gateway is the one
 * over the stored connectors (`connectors.ts`), and Code Mode reaches its tools unchanged (CHG-0441).
 */
export const noConnectorsLayer = Layer.succeed(ConnectorGateway, {
  beginTurn: () => Effect.succeed([]),
  call: (_threadId, name) => Effect.succeed(unknownToolAnswer(name)),
  endTurn: () => Effect.void,
  listingFor: () => Effect.succeed([]),
});
