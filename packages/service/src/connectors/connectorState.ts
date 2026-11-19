import type { ApplePermissionStatus } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { isToolOffered, type Standing, type ToolStanding } from "./availability.ts";
import { type CatalogEntry, catalogToolOf, entryOf, listedNameOf } from "./catalog.ts";
import {
  type ConnectorRecord,
  readChoices,
  readConnectorRecords,
  readOffTools,
  readSubject,
} from "./connectorStore.ts";
import type { ToolListing } from "./toolListing.ts";
import type { VaultPort } from "./vaultPort.ts";

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
  readonly applePermissionOf: (connectorId: string, app: string) => ApplePermissionStatus;
  readonly catalog: ReadonlyArray<CatalogEntry>;
  readonly listing: ToolListing;
  readonly sql: SqlClient.SqlClient;
  readonly vault: VaultPort["Service"];
};

/** Whether the owner has given the connector what it needs: no refused sign-in recorded and every secret held. */
const isConnected = (vault: VaultPort["Service"], entry: CatalogEntry, record: ConnectorRecord) =>
  record.needs !== null
    ? Effect.succeed(false)
    : entry.secretKind === null
      ? Effect.succeed(true)
      : vault.holds(entry.id, entry.secretKind).pipe(Effect.catch(() => Effect.succeed(false)));

/** The actionable card state when any chosen Apple app still needs a check or a grant. */
export const appleConnectionNeedOf = (dependencies: StateDependencies, record: ConnectorRecord) => {
  const apps = record.apps ?? [];
  if (apps.length === 0) return "Choose at least one Apple app.";
  return apps.some((app) => dependencies.applePermissionOf(record.id, app) !== "Allowed")
    ? "Some chosen apps need permission on the computer."
    : null;
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
        ? (record.apps ?? []).some((app) => dependencies.applePermissionOf(entry.id, app) === "Allowed")
        : yield* isConnected(dependencies.vault, entry, record),
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
        : new Set(record.apps.filter((app) => dependencies.applePermissionOf(record.id, app) === "Allowed")),
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
