import { Context, type Effect, Schema } from "effect";
import type { CatalogEntry } from "./catalog.ts";

// What a connector's server must offer the gateway (connectors blueprint, Backends). The Streamable-HTTP adapter
// lives in `backends/httpMcp.ts`; the stdio one comes with the second half of blueprint step 4; every test until
// then uses the scripted fake in `test/fixtures/`.

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

/** Opens the backend a catalog entry names; the service's default does this per entry (backends/defaultBackends.ts). */
export class ConnectorBackends extends Context.Service<
  ConnectorBackends,
  {
    readonly open: (entry: CatalogEntry) => Effect.Effect<ConnectorBackend>;
  }
>()("outlore/connectors/ConnectorBackends") {}
