import { Effect, Layer } from "effect";
import { BackendFailure, type ConnectorBackend, ConnectorBackends } from "../backend.ts";
import type { CatalogEntry } from "../catalog.ts";
import { stdioCommandOf, stdioMcpBackend } from "./stdioMcp.ts";

// The service's default backends (connectors blueprint, Order step 4): a Stdio entry runs its pinned vendored server as
// a child of the host, started on first use; an HTTP entry stays unreachable until the HTTP adapter is built, which
// is the other half of the step.

/** The unreachable answer of a connector whose adapter is not built yet. */
const unreachableBackend = (): ConnectorBackend => {
  const failure = () =>
    Effect.fail(new BackendFailure({ class: "Unreachable", upstream: "No backend is built for this connector yet." }));
  return { call: failure, close: Effect.void, listTools: failure };
};

/** Opens the backend a catalog entry names: a stdio child for a Stdio entry, unreachable until HTTP is built. */
export const defaultBackendsLayer = Layer.succeed(ConnectorBackends, {
  open: (entry: CatalogEntry) =>
    entry.backend._tag === "Stdio"
      ? stdioMcpBackend({
          command: stdioCommandOf(entry.backend.server),
          ...(entry.backend.env === undefined ? {} : { env: entry.backend.env }),
          label: entry.name,
        })
      : Effect.succeed(unreachableBackend()),
});
