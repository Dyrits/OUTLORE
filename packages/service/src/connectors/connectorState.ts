import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import type { ApplePermissions } from "./applePermissions.ts";
import { isToolOffered, type Standing, type ToolStanding } from "./availability.ts";
import type { ConnectorCalls } from "./calls.ts";
import { type CatalogEntry, catalogToolOf, credentialsOf, entryOf, listedNameOf, oauthSecretKind } from "./catalog.ts";
import {
  type ConnectorRecord,
  readChoices,
  readConnectorRecords,
  readOffTools,
  readSubject,
} from "./connectorStore.ts";
import type { ToolListing } from "./toolListing.ts";
import type { VaultPort, VaultUnavailable } from "./vaultPort.ts";

// What decides whether a thread is offered a connector's tool, read from the store (connectors blueprint, Who may use what).

/** One tool as a thread is offered it. */
export type OfferedConnectorTool = {
  readonly app: string | null;
  readonly connector: string;
  readonly description: string;
  readonly inputSchema: Readonly<Record<string, unknown>>;
  /** The name the thread lists and calls: `<connector>__<tool>`. */
  readonly listedName: string;
  /** The tool's exact name at its server. */
  readonly tool: string;
};

/** What the state reads need. */
export type StateDependencies = {
  readonly catalog: ReadonlyArray<CatalogEntry>;
  readonly listing: ToolListing;
  readonly permissions: ApplePermissions;
  readonly sql: SqlClient.SqlClient;
  readonly vault: VaultPort["Service"];
};

/** Connection status read from the Vault, surfacing why the Vault could not answer instead of hiding it as missing. */
export type ConnectionState = {
  readonly isConnected: boolean;
  readonly vaultReason: VaultUnavailable["reason"] | null;
};

const holdsOrReason = (
  vault: VaultPort["Service"],
  connectorId: string,
  kind: string,
): Effect.Effect<ConnectionState> =>
  vault.holds(connectorId, kind).pipe(
    Effect.map((isConnected): ConnectionState => ({ isConnected, vaultReason: null })),
    Effect.catchTag("VaultUnavailable", (failure) =>
      Effect.succeed<ConnectionState>({ isConnected: false, vaultReason: failure.reason }),
    ),
  );

/** Whether the owner has given the connector what it needs, and any Vault unavailability preventing the check. */
export const readConnectionState = (
  vault: VaultPort["Service"],
  entry: CatalogEntry,
  record: ConnectorRecord,
): Effect.Effect<ConnectionState> => {
  if (record.needs !== null) return Effect.succeed({ isConnected: false, vaultReason: null });
  return Match.valueTags(credentialsOf(entry), {
    Either: ({ kind }) =>
      holdsOrReason(vault, entry.id, oauthSecretKind).pipe(
        Effect.flatMap((oauth) =>
          oauth.isConnected || oauth.vaultReason !== null
            ? Effect.succeed(oauth)
            : holdsOrReason(vault, entry.id, kind),
        ),
      ),
    Key: ({ kind }) => holdsOrReason(vault, entry.id, kind),
    None: () => Effect.succeed({ isConnected: true, vaultReason: null }),
    OAuth: () => holdsOrReason(vault, entry.id, oauthSecretKind),
  });
};

/** The standing of one installed connector. */
export const readStanding = Effect.fnUntraced(function* (
  dependencies: StateDependencies,
  entry: CatalogEntry,
  record: ConnectorRecord,
) {
  const choices = yield* readChoices(record.id).pipe(Effect.provideService(SqlClient.SqlClient, dependencies.sql));
  return {
    choices,
    isConnected:
      entry.apps.length > 0
        ? (record.apps ?? []).some((app) => dependencies.permissions.read(entry.id, app) === "Allowed")
        : (yield* readConnectionState(dependencies.vault, entry, record)).isConnected,
    isEnabled: record.isEnabled,
    isInstalled: true,
    isRemoving: record.isRemoving,
  } satisfies Standing;
});

/** The extra facts that decide one connector's tools. */
export const readToolStanding = Effect.fnUntraced(function* (dependencies: StateDependencies, record: ConnectorRecord) {
  const offTools = yield* readOffTools(record.id).pipe(Effect.provideService(SqlClient.SqlClient, dependencies.sql));
  return {
    chosenApps:
      record.apps === null
        ? null
        : new Set(record.apps.filter((app) => dependencies.permissions.read(record.id, app) === "Allowed")),
    offTools,
  } satisfies ToolStanding;
});

/** The tools the thread is offered now, from what each connector's server last listed. */
export const readOfferedTools = Effect.fnUntraced(function* (dependencies: StateDependencies, threadId: string) {
  const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
  const subject = yield* readSubject(threadId).pipe(provided);
  if (subject === null) return [];
  const offered: Array<OfferedConnectorTool> = [];
  for (const record of yield* readConnectorRecords.pipe(provided)) {
    const entry = entryOf(dependencies.catalog, record.id);
    if (entry === null) continue;
    const standing = yield* readStanding(dependencies, entry, record);
    const toolStanding = yield* readToolStanding(dependencies, record);
    for (const tool of dependencies.listing.cachedTools(entry.id)) {
      const app = catalogToolOf(entry, tool.name)?.app ?? null;
      if (!isToolOffered(standing, toolStanding, { app, name: tool.name }, subject)) continue;
      offered.push({
        app,
        connector: entry.id,
        description: tool.description,
        inputSchema: tool.inputSchema,
        listedName: listedNameOf(entry.id, tool.name),
        tool: tool.name,
      });
    }
  }
  return offered;
});

/** Removes from every thread's snapshot what the stored choices no longer offer it; the reads run in the caller's transaction. */
export const narrowSnapshotsToOffered = (
  dependencies: StateDependencies & { readonly calls: ConnectorCalls["Service"] },
) =>
  dependencies.calls.narrowSnapshots((threadId) =>
    readOfferedTools(dependencies, threadId).pipe(
      Effect.map((tools) => new Set(tools.map((tool) => tool.listedName))),
      Effect.orDie,
    ),
  );
