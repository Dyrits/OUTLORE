import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type Changes, invalid, notFound, ServiceFailure } from "../core/index.ts";
import { probeApplePermissions } from "./applePermission.ts";
import { credentialsOf, defaultAppsOf, entryOf, isOAuthEntry, oauthSecretKind } from "./catalog.ts";
import { type CallDependencies, narrowPermittedTools } from "./connectorCall.ts";
import { type CardDependencies, readCard } from "./connectorCards.ts";
import { readConnectorRecord, writeNeeds } from "./connectorStore.ts";
import { type BrowserOpener, encodeOAuthSession, runOAuthSignIn } from "./oauth/index.ts";
import { failureOutcomeOf } from "./toolListing.ts";

/** Dependencies needed by host-side connector sign-in and Apple Automation permission flows. */
export type AuthFlowDependencies = CardDependencies & {
  readonly callDependencies: CallDependencies;
  readonly changes: Changes["Service"];
  readonly openBrowser: BrowserOpener;
};

/** Asks macOS through the connector's own backend whether each chosen app allows Automation. */
export const requestAppleConnectorPermission = (dependencies: AuthFlowDependencies, connectorId: string) =>
  Effect.gen(function* () {
    const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
    const entry = entryOf(dependencies.catalog, connectorId);
    if (entry === null) return yield* notFound("Outlore offers no such connector.");
    if (entry.platform === "macOS" && dependencies.platform !== "darwin")
      return yield* invalid(
        "Apple's applications on macOS run on a Mac only, so there is no permission to ask for here.",
      );
    const record = yield* readConnectorRecord(connectorId).pipe(provided);
    if (record === null || record.isRemoving || entry.apps.length === 0)
      return yield* invalid("That Apple's applications on macOS connector is not installed on this computer.");
    const apps = record.apps ?? defaultAppsOf(entry);
    const revision = dependencies.permissions.revision();
    // The probe runs on the backend the connector's calls run on, so macOS is asked by the same child process.
    const backend = yield* dependencies.listing.openBackend(entry);
    const report = yield* probeApplePermissions(entry, apps, backend);
    if (dependencies.permissions.recordIfCurrent(connectorId, revision, report.apps)) {
      yield* narrowPermittedTools(dependencies.callDependencies, null);
      yield* dependencies.changes.publish;
    }
    return report;
  });

/** Runs the generic MCP OAuth 2.1 browser sign-in flow for an installed OAuth connector and persists the session. */
export const signInConnector = (dependencies: AuthFlowDependencies, connectorId: string) =>
  Effect.gen(function* () {
    const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
    const entry = entryOf(dependencies.catalog, connectorId);
    if (entry === null) return yield* notFound("Outlore offers no such connector.");
    if (!isOAuthEntry(entry)) {
      return yield* invalid("That connector does not sign in through OAuth.");
    }
    const record = yield* readConnectorRecord(connectorId).pipe(provided);
    if (record === null || record.isRemoving) {
      return yield* invalid("Install that connector before signing in.");
    }
    const session = yield* runOAuthSignIn(entry.backend, { openBrowser: dependencies.openBrowser }).pipe(
      Effect.mapError((failure) => new ServiceFailure({ kind: "ExecutionFailure", message: failure.message })),
    );
    yield* dependencies.vault.putOrReplace(entry.id, oauthSecretKind, encodeOAuthSession(session)).pipe(
      Effect.catchTag("VaultUnavailable", (failure) =>
        Effect.fail(
          new ServiceFailure({
            kind: failure.reason === "NotProtected" ? "AccessRefused" : "ExecutionFailure",
            message:
              failure.reason === "NotProtected"
                ? "The Vault cannot store the OAuth session until its folder protection is verified."
                : failure.reason === "Invalid"
                  ? "The OAuth session is too large for the Vault to store."
                  : "Could not save the OAuth session in the Vault.",
          }),
        ),
      ),
    );
    // A browser sign-in that completed removes the entry's prior static key, so the two credential kinds stay mutually exclusive.
    const credentials = credentialsOf(entry);
    if (credentials._tag === "Either") {
      yield* dependencies.vault.remove(entry.id, credentials.kind).pipe(Effect.ignore);
    }
    yield* writeNeeds(entry.id, null).pipe(provided);
    // Drop any prior HTTP backend and MCP session so the new token starts a fresh session handshake.
    yield* dependencies.listing.forget(entry.id);
    const listed = yield* dependencies.listing.refresh(entry);
    if (listed._tag === "Failed") {
      const { isRefused } = failureOutcomeOf(listed.failure);
      const httpStatus = listed.failure._tag === "BackendFailure" ? listed.failure.httpStatus : undefined;
      const statusSuffix = httpStatus === undefined ? "" : ` (HTTP ${httpStatus})`;
      if (isRefused) {
        const reason = `${entry.name} accepted the sign-in, but its server refused the token${statusSuffix}. Check the granted scopes or site and connect again.`;
        yield* writeNeeds(entry.id, reason).pipe(provided);
        yield* dependencies.listing.forget(entry.id);
        yield* narrowPermittedTools(dependencies.callDependencies, null);
        yield* dependencies.changes.publish;
        return yield* new ServiceFailure({ kind: "ExecutionFailure", message: reason });
      }
      yield* dependencies.changes.publish;
      return yield* new ServiceFailure({
        kind: "ExecutionFailure",
        message: `${entry.name} signed in, but its tool list could not be read${statusSuffix}. Try again shortly.`,
      });
    }
    yield* dependencies.changes.publish;
    return yield* readCard(dependencies, entry);
  });
