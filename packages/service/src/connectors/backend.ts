import { Context, Effect, Layer, Schema } from "effect";
import type { CatalogEntry } from "./catalog.ts";

// What a connector's server must offer the gateway (connectors blueprint, Backends). The HTTP and stdio adapters come with
// blueprint step 4; every test uses the scripted fake in `test/fixtures/`.

/** One tool as its server lists it; the catalog, not this, decides how it is classified. */
export type BackendTool = {
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** The tool's exact name at the server. */
  readonly name: string;
};

/**
 * The public class of a backend failure: `Disconnected` (credentials rejected, permission refused), `Unreachable`, `InvalidArguments`
 * (the thread's own malformed call) and `Failed` (anything else). Only the class leaves the gateway.
 */
export const ConnectorErrorClass = Schema.Literals(["Disconnected", "Unreachable", "InvalidArguments", "Failed"]);
export type ConnectorErrorClass = typeof ConnectorErrorClass.Type;

/**
 * A server's failure. `upstream` is the server's own words, kept for no one: it is never forwarded to a thread, stored or
 * logged, since a server may echo the secret it was given.
 */
export class BackendFailure extends Schema.TaggedError<BackendFailure>()("BackendFailure", {
  class: ConnectorErrorClass,
  upstream: Schema.String,
}) {}

/** One connector's server, started on first use. A secret is given per call and never kept. */
export interface ConnectorBackend {
  /** Calls one tool; the answer is the tool's text. */
  readonly call: (tool: string, args: unknown, secret: string | null) => Effect.Effect<string, BackendFailure>;
  /** Stops the server and anything it started. */
  readonly close: Effect.Effect<void>;
  /** The server's own listing of its tools. */
  readonly listTools: (secret: string | null) => Effect.Effect<ReadonlyArray<BackendTool>, BackendFailure>;
}

/** Opens the backend a catalog entry names. */
export class ConnectorBackends extends Context.Service<
  ConnectorBackends,
  {
    readonly open: (entry: CatalogEntry) => Effect.Effect<ConnectorBackend>;
  }
>()("outlore/connectors/ConnectorBackends") {}

/**
 * The backends until the real adapters are built: every server is unreachable, so an installed connector offers no tool and
 * warns once, which is what the service honestly can do for it.
 */
export const unbuiltBackendsLayer = Layer.succeed(ConnectorBackends, {
  open: () =>
    Effect.succeed({
      call: () =>
        Effect.fail(new BackendFailure({ class: "Unreachable", upstream: "No backend is built for this connector." })),
      close: Effect.void,
      listTools: () =>
        Effect.fail(new BackendFailure({ class: "Unreachable", upstream: "No backend is built for this connector." })),
    } satisfies ConnectorBackend),
});
