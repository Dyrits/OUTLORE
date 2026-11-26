import type { ApplePermissionStatus } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type Changes, invalid, notFound, ServiceFailure } from "../core/index.ts";
import { applePermissionReportOf } from "./applePermission.ts";
import {
  type CatalogEntry,
  defaultAppsOf,
  entryOf,
  hasStaticSecret,
  isOAuthEntry,
  oauthSecretKind,
} from "./catalog.ts";
import { type CallDependencies, narrowPermittedTools } from "./connectorCall.ts";
import { type CardDependencies, cardOf } from "./connectorCards.ts";
import { readConnectorRecord, writeNeeds } from "./connectorStore.ts";
import { type BrowserOpener, encodeOAuthSession, runOAuthSignIn } from "./oauth/index.ts";
import type { ToolListing } from "./toolListing.ts";
import type { VaultPort } from "./vaultPort.ts";

/** Dependencies needed by host-side connector sign-in and Apple Automation permission flows. */
export type AuthFlowDependencies = {
  readonly callDependencies: CallDependencies;
  readonly cardDependencies: CardDependencies;
  readonly catalog: ReadonlyArray<CatalogEntry>;
  readonly changes: Changes["Service"];
  readonly listing: ToolListing;
  readonly openBrowser: BrowserOpener | undefined;
  readonly permissions: Map<string, Map<string, ApplePermissionStatus>>;
  readonly platform: NodeJS.Platform;
  readonly readPermissionRevision: () => number;
  readonly refreshFor: (
    entry: CatalogEntry,
    threadId: string | null,
  ) => Effect.Effect<void, import("effect/sql").SqlError.SqlError>;
  readonly sql: SqlClient.SqlClient;
  readonly vault: VaultPort["Service"];
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
    const revision = dependencies.readPermissionRevision();
    // The probe runs on the backend the connector's calls run on, so macOS is asked by the same child process.
    const backend = yield* dependencies.listing.backendOf(entry);
    const report = yield* applePermissionReportOf(entry, apps, backend);
    if (revision === dependencies.readPermissionRevision()) {
      dependencies.permissions.set(connectorId, new Map(report.apps.map(({ app, status }) => [app, status])));
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
    if (!isOAuthEntry(entry) || entry.backend._tag !== "Http") {
      return yield* invalid("That connector does not sign in through OAuth.");
    }
    const record = yield* readConnectorRecord(connectorId).pipe(provided);
    if (record === null || record.isRemoving) {
      return yield* invalid("Install that connector before signing in.");
    }
    const session = yield* runOAuthSignIn(entry.backend, {
      ...(dependencies.openBrowser === undefined ? {} : { openBrowser: dependencies.openBrowser }),
    }).pipe(Effect.mapError((failure) => new ServiceFailure({ kind: "ExecutionFailure", message: failure.message })));
    yield* dependencies.vault.putOrReplace(entry.id, oauthSecretKind, encodeOAuthSession(session)).pipe(
      Effect.catchTag("VaultUnavailable", (failure) =>
        Effect.fail(
          new ServiceFailure({
            kind: failure.reason === "NotProtected" ? "AccessRefused" : "ExecutionFailure",
            message:
              failure.reason === "NotProtected"
                ? "The Vault cannot store the OAuth session until its folder protection is verified."
                : "Could not save the OAuth session in the Vault.",
          }),
        ),
      ),
    );
    // A browser sign-in that completed removes the entry's prior static key, so the two credential kinds stay mutually exclusive.
    if (hasStaticSecret(entry) && entry.secretKind !== null) {
      yield* dependencies.vault.remove(entry.id, entry.secretKind).pipe(Effect.ignore);
    }
    yield* writeNeeds(entry.id, null).pipe(provided);
    yield* dependencies.refreshFor(entry, null);
    yield* dependencies.changes.publish;
    return yield* cardOf(dependencies.cardDependencies, entry);
  });
