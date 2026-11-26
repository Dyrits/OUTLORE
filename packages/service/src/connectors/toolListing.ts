import { Clock, Effect, Semaphore } from "effect";
import { fieldOf } from "../core/index.ts";
import {
  BackendFailure,
  type BackendTool,
  type ConnectorBackend,
  type ConnectorBackends,
  type ConnectorErrorClass,
} from "./backend.ts";
import { type CatalogEntry, isOAuthEntry, isToolName, oauthSecretKind } from "./catalog.ts";
import { redactedOf } from "./connectorErrors.ts";
import {
  decodeOAuthSession,
  encodeOAuthSession,
  isSessionExpired,
  oauthSecretsOf,
  refreshOAuthToken,
} from "./oauth/index.ts";
import type { SecretMissing, VaultPort, VaultUnavailable } from "./vaultPort.ts";

// A connector's server and what it last listed (connectors blueprint, Gateway: the listing is "read from the backend's
// `tools/list` cached per connector and refreshed on install, on a failed call and at each turn start").

/** A failure of a call or a listing, whichever part of it failed: the server, a missing secret, or the Vault. */
export type CredentialedFailure = BackendFailure | SecretMissing | VaultUnavailable;

/** What a failure comes to: the public class, and whether it is the server that refused the credentials. */
export const failureOutcomeOf = (
  failure: CredentialedFailure,
): { errorClass: ConnectorErrorClass; isRefused: boolean } =>
  failure._tag === "BackendFailure"
    ? { errorClass: failure.class, isRefused: failure.class === "Disconnected" }
    : // A missing secret or an unreadable Vault is not a refusal by the server: the connector shows what it lacks, and
      // nothing is written for it, since the state is read again each time.
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

/** Scrubs keys as well as nested values while the Vault still lends the secret. */
const redactMetadata = (value: unknown, secrets: ReadonlyArray<string>): unknown => {
  if (typeof value === "string") return redactedOf(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactMetadata(item, secrets));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [redactedOf(key, secrets), redactMetadata(item, secrets)]),
  );
};

const redactedTools = (
  tools: ReadonlyArray<BackendTool>,
  secrets: ReadonlyArray<string>,
): ReadonlyArray<BackendTool> =>
  secrets.length === 0
    ? tools
    : tools.map((tool) => ({
        description: redactedOf(tool.description, secrets),
        inputSchema: Object.fromEntries(
          Object.entries(tool.inputSchema).map(([key, value]) => [
            redactedOf(key, secrets),
            redactMetadata(value, secrets),
          ]),
        ),
        name: redactedOf(tool.name, secrets),
      }));

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
  const refreshes = new Map<string, Semaphore.Semaphore>();
  const refreshLockOf = (connectorId: string) => {
    const existing = refreshes.get(connectorId);
    if (existing !== undefined) return existing;
    const created = Semaphore.makeUnsafe(1);
    refreshes.set(connectorId, created);
    return created;
  };

  /** Refreshes an OAuth session under the connector's lock and stores the new session in the Vault. */
  const refreshOAuthSession = (connectorId: string, staleAccessToken: string | null) =>
    refreshLockOf(connectorId).withPermit(
      Effect.gen(function* () {
        const currentRaw = yield* vault.withSecret(connectorId, oauthSecretKind, (raw) => Effect.succeed(raw));
        const current = decodeOAuthSession(currentRaw);
        if (current === null) {
          return yield* new BackendFailure({
            class: "Disconnected",
            upstream: "The stored OAuth session could not be read.",
          });
        }
        const nowMillis = yield* Clock.currentTimeMillis;
        // Another concurrent request may already have refreshed the session while we waited for the permit.
        if (
          staleAccessToken !== null &&
          current.accessToken !== staleAccessToken &&
          !isSessionExpired(current, nowMillis)
        ) {
          return { secrets: [currentRaw, ...oauthSecretsOf(current)], session: current };
        }
        const refreshed = yield* refreshOAuthToken(current).pipe(
          Effect.mapError(
            () =>
              new BackendFailure({
                class: "Disconnected",
                upstream: "The server refused to refresh the connector's sign-in.",
              }),
          ),
        );
        const encoded = encodeOAuthSession(refreshed);
        yield* vault.putOrReplace(connectorId, oauthSecretKind, encoded);
        return {
          secrets: [currentRaw, encoded, ...oauthSecretsOf(current), ...oauthSecretsOf(refreshed)],
          session: refreshed,
        };
      }),
    );

  const backendOf = (entry: CatalogEntry) =>
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

  /** Runs a use of the server with the connector's secret, refreshing OAuth tokens on expiry or 401. */
  const withCredentials = <A, E, R>(
    entry: CatalogEntry,
    use: (
      backend: ConnectorBackend,
      secret: string | null,
      redactionSecrets: ReadonlyArray<string>,
    ) => Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | BackendFailure | SecretMissing | VaultUnavailable, R> =>
    Effect.gen(function* () {
      const backend = yield* backendOf(entry);
      if (entry.secretKind === null) return yield* use(backend, null, []);
      if (!isOAuthEntry(entry)) {
        return yield* vault.withSecret(entry.id, entry.secretKind, (secret) => use(backend, secret, [secret]));
      }
      const initialRaw = yield* vault.withSecret(entry.id, entry.secretKind, (raw) => Effect.succeed(raw));
      const initial = decodeOAuthSession(initialRaw);
      if (initial === null) {
        return yield* new BackendFailure({
          class: "Disconnected",
          upstream: "The stored OAuth session could not be read.",
        });
      }
      const nowMillis = yield* Clock.currentTimeMillis;
      let active = initial;
      let secrets: ReadonlyArray<string> = [initialRaw, ...oauthSecretsOf(initial)];
      if (isSessionExpired(initial, nowMillis) && initial.refreshToken !== null) {
        const refreshed = yield* refreshOAuthSession(entry.id, initial.accessToken);
        active = refreshed.session;
        secrets = [...secrets, ...refreshed.secrets];
      }
      const firstAttempt = yield* use(backend, active.accessToken, secrets).pipe(Effect.result);
      if (firstAttempt._tag === "Success") return firstAttempt.success;
      const failure = firstAttempt.failure;
      const isDisconnected =
        fieldOf(failure, "_tag") === "BackendFailure" && fieldOf(failure, "class") === "Disconnected";
      if (!isDisconnected || active.refreshToken === null) return yield* Effect.fail(failure);
      const refreshed = yield* refreshOAuthSession(entry.id, active.accessToken);
      const allSecrets = [...secrets, ...refreshed.secrets];
      return yield* use(backend, refreshed.session.accessToken, allSecrets);
    });

  /** Asks the server for its tools again, keeping them on success and forgetting them on failure. */
  const refresh = (entry: CatalogEntry): Effect.Effect<Listing> =>
    withCredentials(entry, (backend, secret, redactionSecrets) =>
      backend.listTools(secret).pipe(Effect.map((tools) => redactedTools(tools, redactionSecrets))),
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
    backendOf,
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
    refresh,
    withCredentials,
  };
};

/** The tool listing of the connectors, as the gateway uses it. */
export type ToolListing = ReturnType<typeof makeToolListing>;
