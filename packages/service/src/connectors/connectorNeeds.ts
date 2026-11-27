import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import type { Changes } from "../core/index.ts";
import type { ApplePermissions } from "./applePermissions.ts";
import { type CatalogEntry, credentialsOf } from "./catalog.ts";
import type { ConnectorRecord } from "./connectorStore.ts";
import { readConnectorRecord, writeNeeds } from "./connectorStore.ts";
import type { VaultUnavailable } from "./vaultPort.ts";

// Single owner for a connector's Needs connecting text, Vault unavailability wording, and database writes.

/** What the owner reads under Needs connecting for a connector whose credentials were refused. */
export const needsReasonOf = (name: string) => `${name} refused its sign-in or permission. Connect it again.`;

/** The actionable card state when any chosen Apple app still needs a check or a grant. */
export const appleConnectionNeedOf = (permissions: ApplePermissions, record: ConnectorRecord) => {
  const apps = record.apps ?? [];
  if (apps.length === 0) return "Choose at least one Apple app.";
  return apps.some((app) => permissions.read(record.id, app) !== "Allowed")
    ? "Some chosen apps need permission on the computer."
    : null;
};

/** Fixed words shown on a connector card when the Vault itself cannot answer. */
export const vaultNeedOf = (reason: VaultUnavailable["reason"]): string =>
  reason === "Locked"
    ? "The Vault is locked. Unlock it to use this connector."
    : reason === "Lost"
      ? "The Vault's key is missing. Check the Vault tab."
      : reason === "NotProtected"
        ? "The Vault's folder protection could not be verified. Check the Vault tab."
        : "The Vault could not be read. Check the Vault tab.";

/** Computes the Needs connecting text for an installed non-app connector card. */
export const cardNeedsOf = (
  entry: CatalogEntry,
  record: ConnectorRecord,
  connection: { readonly isConnected: boolean; readonly vaultReason: VaultUnavailable["reason"] | null },
): string | null => {
  if (record.needs !== null) return record.needs;
  if (connection.vaultReason !== null) return vaultNeedOf(connection.vaultReason);
  if (connection.isConnected) return null;
  return Match.valueTags(credentialsOf(entry), {
    Either: ({ kind }) => `Sign in in your browser or add your ${kind} below.`,
    Key: ({ kind }) => `Add your ${kind} below.`,
    None: () => null,
    OAuth: () => "Sign in in your browser to connect.",
  });
};

/** Writes a connector's Needs connecting reason (or clears it with null) and publishes a change event. */
export const writeNeedsAndPublish = (
  dependencies: { readonly changes: Changes["Service"]; readonly sql: SqlClient.SqlClient },
  connectorId: string,
  reason: string | null,
) =>
  writeNeeds(connectorId, reason).pipe(
    Effect.provideService(SqlClient.SqlClient, dependencies.sql),
    Effect.andThen(dependencies.changes.publish),
  );

/** Marks a connector Needs connecting inside a transaction when it is installed and not already marked. */
export const markNeedsIfUnset = Effect.fnUntraced(function* (
  dependencies: { readonly changes: Changes["Service"]; readonly sql: SqlClient.SqlClient },
  connectorId: string,
  reason: string,
) {
  const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
  const record = yield* readConnectorRecord(connectorId).pipe(provided);
  if (record === null || record.needs !== null) return;
  yield* dependencies.sql
    .withTransaction(writeNeeds(connectorId, reason).pipe(provided))
    .pipe(Effect.andThen(dependencies.changes.publish));
});
