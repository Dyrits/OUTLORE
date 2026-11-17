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
    /** The usable, switched-on connector tools of the thread. */
    readonly listingFor: (threadId: string) => Effect.Effect<ReadonlyArray<ConnectorTool>>;
    /** Calls one connector tool for the thread; a refusal or a failure is an error answer, never a failure. */
    readonly call: (threadId: string, name: string, args: unknown) => Effect.Effect<ToolAnswer>;
  }
>()("outlore/ConnectorGateway") {}

/**
 * The gateway while no connector can be installed: it offers no tool. The real gateway replaces it with the
 * connectors' slice 3 (connectors blueprint, Order), and Code Mode then reaches its tools unchanged (CHG-0441).
 */
export const noConnectorsLayer = Layer.succeed(ConnectorGateway, {
  call: (_threadId, name) => Effect.succeed(unknownToolAnswer(name)),
  listingFor: () => Effect.succeed([]),
});
