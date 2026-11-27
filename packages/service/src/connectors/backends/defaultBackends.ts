import { Effect, Layer } from "effect";
import { ConnectorBackends } from "../backend.ts";
import { httpMcpBackend } from "./httpMcp.ts";
import { stdioMcpBackend } from "./stdioMcp.ts";
import { stdioCommandOf } from "./stdioMcpCommand.ts";

// The service's default backends (connectors blueprint, Order step 4): an HTTP entry opens the Streamable-HTTP adapter, which holds no process; a Stdio entry runs its pinned vendored server as a child of the host, started on first use.

/** Opens the backend a catalog entry names: the Streamable-HTTP adapter for an Http entry, a stdio child for a Stdio entry. */
export const connectorBackendsLayer = Layer.succeed(ConnectorBackends, {
  open: (entry) => {
    const { backend } = entry;
    if (backend._tag === "Http") return Effect.succeed(httpMcpBackend(backend));
    return Effect.flatMap(stdioCommandOf(backend.server), (command) =>
      stdioMcpBackend({
        command,
        ...(backend.env === undefined ? {} : { env: backend.env }),
        hasAppleAutomation: entry.platform === "macOS" && entry.apps.length > 0,
        label: entry.name,
      }),
    );
  },
});
