import type { ConnectorCard, ConnectorToolCard } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type CatalogEntry, catalogToolOf, isRunnableOn } from "./catalog.ts";
import { appleConnectionNeedOf, readStanding, readToolStanding, type StateDependencies } from "./connectorState.ts";
import { type ConnectorRecord, readChoices, readConnectorRecord } from "./connectorStore.ts";

// A connector as the Charter shows it (connectors specification, Install, connect, enable; A connector's tools).

/** What the card of a connector needs beyond the state reads: the host's platform. */
export type CardDependencies = StateDependencies & { readonly platform: NodeJS.Platform };

const toolCardsOf = Effect.fnUntraced(function* (
  dependencies: CardDependencies,
  entry: CatalogEntry,
  record: ConnectorRecord | null,
) {
  const listed = dependencies.listing.cachedTools(entry.id).map((tool) => tool.name);
  const names = [...new Set([...Object.keys(entry.tools), ...listed])].toSorted();
  const offTools = record === null ? new Set<string>() : (yield* readToolStanding(dependencies, record)).offTools;
  return names.map((name): ConnectorToolCard => {
    const named = catalogToolOf(entry, name);
    return {
      app: named?.app ?? null,
      class: named === null ? "Unclassified" : named.class,
      description: named?.summary ?? `The tool "${name}", which Outlore has no description of; it asks every time.`,
      isOn: !offTools.has(name),
      name,
    };
  });
});

/** The card of one catalog entry, installed or not. */
export const cardOf = Effect.fnUntraced(function* (dependencies: CardDependencies, entry: CatalogEntry) {
  const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
  const record = yield* readConnectorRecord(entry.id).pipe(provided);
  const base = {
    apps: entry.apps.map((app) => ({
      id: app.id,
      isChosen: record === null ? app.isDefault : (record.apps ?? []).includes(app.id),
      name: app.name,
      ...(record?.apps?.includes(app.id) ? { permission: dependencies.applePermissionOf(entry.id, app.id) } : {}),
    })),
    description: entry.description,
    id: entry.id,
    name: entry.name,
    notice: entry.notice,
    secretKinds: entry.secretKind === null ? [] : [entry.secretKind],
  };
  if (record === null) {
    const isMissingMac = !isRunnableOn(entry, dependencies.platform);
    return {
      ...base,
      borderlandsChoice: null,
      isEnabled: false,
      needs: isMissingMac ? "Needs a Mac." : null,
      state: isMissingMac ? "NeedsMac" : "NotInstalled",
      tools: yield* toolCardsOf(dependencies, entry, null),
    } satisfies ConnectorCard;
  }
  const standing = yield* readStanding(dependencies, entry, record);
  const choices = yield* readChoices(entry.id).pipe(provided);
  const needs =
    entry.apps.length > 0
      ? appleConnectionNeedOf(dependencies, record)
      : (record.needs ??
        (standing.isConnected || entry.secretKind === null ? null : `Add your ${entry.secretKind} in the Vault.`));
  return {
    ...base,
    borderlandsChoice: choices.borderlands,
    isEnabled: record.isEnabled,
    needs,
    state: record.isRemoving ? "Removing" : needs === null ? "Ready" : "NeedsConnecting",
    tools: yield* toolCardsOf(dependencies, entry, record),
  } satisfies ConnectorCard;
});
