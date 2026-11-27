import { Clock, Effect, Match, Semaphore } from "effect";
import { fieldOf } from "../core/index.ts";
import { type BackendAuthKind, BackendFailure, type ConnectorBackend } from "./backend.ts";
import { type CatalogEntry, credentialsOf, oauthSecretKind } from "./catalog.ts";
import {
  decodeOAuthSession,
  encodeOAuthSession,
  isSessionExpired,
  oauthSecretsOf,
  refreshOAuthToken,
} from "./oauth/index.ts";
import { SecretMissing, type VaultPort, type VaultUnavailable } from "./vaultPort.ts";

// Credential acquisition and OAuth 2.1 token refresh for connector backend calls (proactive on expiry, reactive on 401).

/** Creates a per-connector credential runner that lends Vault secrets and refreshes OAuth sessions under a lock. */
export const makeCredentialRunner = (dependencies: {
  readonly openBackend: (entry: CatalogEntry) => Effect.Effect<ConnectorBackend>;
  readonly vault: VaultPort["Service"];
}) => {
  const { openBackend, vault } = dependencies;
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
        // Retry once on transient Vault write failure; keep using the rotated token for the in-flight call even if saving fails.
        yield* vault
          .putOrReplace(connectorId, oauthSecretKind, encoded)
          .pipe(Effect.retry({ times: 1 }), Effect.ignore);
        return {
          secrets: [currentRaw, encoded, ...oauthSecretsOf(current), ...oauthSecretsOf(refreshed)],
          session: refreshed,
        };
      }),
    );

  const runWithOAuth = <A, E, R>(
    entry: CatalogEntry,
    backend: ConnectorBackend,
    use: (
      backend: ConnectorBackend,
      secret: string | null,
      redactionSecrets: ReadonlyArray<string>,
      auth: BackendAuthKind,
    ) => Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | BackendFailure | SecretMissing | VaultUnavailable, R> =>
    Effect.gen(function* () {
      const initialRaw = yield* vault.withSecret(entry.id, oauthSecretKind, (raw) => Effect.succeed(raw));
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
      const firstAttempt = yield* use(backend, active.accessToken, secrets, "OAuth").pipe(Effect.result);
      if (firstAttempt._tag === "Success") return firstAttempt.success;
      const failure = firstAttempt.failure;
      const isDisconnected =
        fieldOf(failure, "_tag") === "BackendFailure" && fieldOf(failure, "class") === "Disconnected";
      if (!isDisconnected || active.refreshToken === null) return yield* Effect.fail(failure);
      const refreshed = yield* refreshOAuthSession(entry.id, active.accessToken);
      const allSecrets = [...secrets, ...refreshed.secrets];
      return yield* use(backend, refreshed.session.accessToken, allSecrets, "OAuth");
    });

  /** Runs a use of the server with the connector's secret, refreshing OAuth tokens on expiry or 401. */
  const withCredentials = <A, E, R>(
    entry: CatalogEntry,
    use: (
      backend: ConnectorBackend,
      secret: string | null,
      redactionSecrets: ReadonlyArray<string>,
      auth: BackendAuthKind,
    ) => Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | BackendFailure | SecretMissing | VaultUnavailable, R> =>
    Effect.gen(function* () {
      const backend = yield* openBackend(entry);
      return yield* Match.valueTags(credentialsOf(entry), {
        Either: ({ kind }) =>
          vault
            .holds(entry.id, oauthSecretKind)
            .pipe(
              Effect.flatMap((hasOAuth) =>
                hasOAuth
                  ? runWithOAuth(entry, backend, use)
                  : vault.withSecret(entry.id, kind, (secret) => use(backend, secret, [secret], "Secret")),
              ),
            ),
        Key: ({ kind }) => vault.withSecret(entry.id, kind, (secret) => use(backend, secret, [secret], "Secret")),
        None: () => use(backend, null, [], "Secret"),
        OAuth: () =>
          vault
            .holds(entry.id, oauthSecretKind)
            .pipe(
              Effect.flatMap((hasOAuth) =>
                hasOAuth
                  ? runWithOAuth(entry, backend, use)
                  : Effect.fail(new SecretMissing({ connector: entry.id, kind: oauthSecretKind })),
              ),
            ),
      });
    });

  return { withCredentials };
};
