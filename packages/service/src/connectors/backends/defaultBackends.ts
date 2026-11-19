import { Effect, Layer } from "effect";
import { ConnectorBackends } from "../backend.ts";
import { httpMcpBackend } from "./httpMcp.ts";
import { stdioCommandOf, stdioMcpBackend } from "./stdioMcp.ts";

// The service's default backends (connectors blueprint, Order step 4): an HTTP entry opens the Streamable-HTTP adapter,
// which holds no process; a Stdio entry runs its pinned vendored server as a child of the host, started on first use.

/** Opens the backend a catalog entry names: the Streamable-HTTP adapter for an Http entry, a stdio child for a Stdio entry. */
export const connectorBackendsLayer = Layer.succeed(ConnectorBackends, {
  open: (entry) =>
    entry.backend._tag === "Http"
      ? Effect.succeed(httpMcpBackend(entry.backend))
      : stdioMcpBackend({
          command: stdioCommandOf(entry.backend.server),
          ...(entry.backend.env === undefined ? {} : { env: entry.backend.env }),
          label: entry.name,
        }),
});
