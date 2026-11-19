import type { ConnectorCard, ConnectorToolCard } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { isUsableBy } from "./availability.ts";
import { type CatalogEntry, catalogToolOf, entryOf, isRunnableOn } from "./catalog.ts";
import { appleConnectionNeedOf, readStanding, readToolStanding, type StateDependencies } from "./connectorState.ts";
import {
  type ConnectorRecord,
  readChoices,
  readConnectorRecord,
  readConnectorRecords,
  readSubject,
} from "./connectorStore.ts";

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
        (standing.isConnected || entry.secretKind === null ? null : `Add your ${entry.secretKind} below.`));
  return {
    ...base,
    borderlandsChoice: choices.borderlands,
    isEnabled: record.isEnabled,
    needs,
    state: record.isRemoving ? "Removing" : needs === null ? "Ready" : "NeedsConnecting",
    tools: yield* toolCardsOf(dependencies, entry, record),
  } satisfies ConnectorCard;
});

/** One tool of a usable connector as a thread's panel lists it. */
export type PanelTool = {
  readonly connectorId: string;
  readonly connectorName: string;
  readonly isOn: boolean;
  readonly name: string;
};

/** The last-listed tools of the connectors the thread can use, those switched off included and marked as off. */
export const panelToolsOf = Effect.fnUntraced(function* (dependencies: CardDependencies, threadId: string) {
  const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
  const subject = yield* readSubject(threadId).pipe(provided);
  const tools: Array<PanelTool> = [];
  if (subject === null) return tools;
  for (const record of yield* readConnectorRecords.pipe(provided)) {
    const entry = entryOf(dependencies.catalog, record.id);
    if (entry === null || !isUsableBy(yield* readStanding(dependencies, entry, record), subject)) continue;
    const standing = yield* readToolStanding(dependencies, record);
    for (const tool of dependencies.listing.cachedTools(entry.id)) {
      const app = catalogToolOf(entry, tool.name)?.app ?? null;
      if (standing.chosenApps !== null && (app === null || !standing.chosenApps.has(app))) continue;
      tools.push({
        connectorId: entry.id,
        connectorName: entry.name,
        isOn: !standing.offTools.has(tool.name),
        name: tool.name,
      });
    }
  }
  return tools;
});
