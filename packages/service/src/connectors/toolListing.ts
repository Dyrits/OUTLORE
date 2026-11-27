import { Effect, Semaphore } from "effect";
import type {
  BackendFailure,
  BackendTool,
  ConnectorBackend,
  ConnectorBackends,
  ConnectorErrorClass,
} from "./backend.ts";
import { type CatalogEntry, isToolName } from "./catalog.ts";
import { redactedTools } from "./connectorErrors.ts";
import { makeCredentialRunner } from "./credentials.ts";
import type { SecretMissing, VaultPort, VaultUnavailable } from "./vaultPort.ts";

// A connector's server and what it last listed (connectors blueprint, Gateway: the listing is "read from the backend's `tools/list` cached per connector and refreshed on install, on a failed call and at each turn start").

/** A failure of a call or a listing, whichever part of it failed: the server, a missing secret, or the Vault. */
export type CredentialedFailure = BackendFailure | SecretMissing | VaultUnavailable;

/** What a failure comes to: the public class, and whether it is the server that refused the credentials. */
export const failureOutcomeOf = (
  failure: CredentialedFailure,
): { errorClass: ConnectorErrorClass; isRefused: boolean } =>
  failure._tag === "BackendFailure"
    ? { errorClass: failure.class, isRefused: failure.class === "Disconnected" }
    : // A missing secret or an unreadable Vault is not a refusal by the server: the connector shows what it lacks, and nothing is written for it, since the state is read again each time.
      { errorClass: "Disconnected", isRefused: false };

/** The tools a server listed that a thread may be offered by name. */
const usableNamesOf = (tools: ReadonlyArray<BackendTool>) => {
  const seen = new Set<string>();
  return tools.filter((tool) => {
    if (!isToolName(tool.name) || seen.has(tool.name)) return false;
    seen.add(tool.name);
    return true;
  });
};

/** The result of asking a server for its tools. */
export type Listing =
  | { readonly _tag: "Listed"; readonly tools: ReadonlyArray<BackendTool> }
  | { readonly _tag: "Failed"; readonly failure: CredentialedFailure };

/** The servers opened so far and the tools each last listed. */
export const makeToolListing = (dependencies: {
  readonly backends: ConnectorBackends["Service"];
  readonly vault: VaultPort["Service"];
}) => {
  const { backends, vault } = dependencies;
  const opened = new Map<string, ConnectorBackend>();
  const cache = new Map<string, ReadonlyArray<BackendTool>>();
  const opening = Semaphore.makeUnsafe(1);

  const openBackend = (entry: CatalogEntry) =>
    opening.withPermit(
      Effect.uninterruptibleMask((restore) =>
        Effect.suspend(() => {
          const existing = opened.get(entry.id);
          if (existing !== undefined) return Effect.succeed(existing);
          return restore(backends.open(entry)).pipe(
            Effect.tap((backend) => Effect.sync(() => void opened.set(entry.id, backend))),
          );
        }),
      ),
    );

  const { withCredentials } = makeCredentialRunner({ openBackend, vault });

  /** Asks the server for its tools again, keeping them on success and forgetting them on failure. */
  const refresh = (entry: CatalogEntry): Effect.Effect<Listing> =>
    withCredentials(entry, (backend, secret, redactionSecrets, auth) =>
      backend.listTools(secret, auth).pipe(Effect.map((tools) => redactedTools(tools, redactionSecrets))),
    ).pipe(
      Effect.map((tools): Listing => {
        const usable = usableNamesOf(tools);
        cache.set(entry.id, usable);
        return { _tag: "Listed", tools: usable };
      }),
      Effect.catch((failure) =>
        Effect.sync((): Listing => {
          cache.delete(entry.id);
          return { _tag: "Failed", failure };
        }),
      ),
    );

  return {
    /** The tools the server last listed, empty before it has. */
    cachedTools: (connectorId: string): ReadonlyArray<BackendTool> => cache.get(connectorId) ?? [],
    /** Closes the server and forgets what it listed, as a connector is removed. */
    forget: (connectorId: string) =>
      opening.withPermit(
        Effect.suspend(() => {
          const backend = opened.get(connectorId);
          opened.delete(connectorId);
          cache.delete(connectorId);
          return backend === undefined ? Effect.void : backend.close;
        }),
      ),
    openBackend,
    refresh,
    withCredentials,
  };
};

/** The tool listing of the connectors, as the gateway uses it. */
export type ToolListing = ReturnType<typeof makeToolListing>;
