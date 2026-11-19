import type { ConnectorChoiceCard, ConnectorChoiceLevel } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import type { ConnectorChoices, SwitchChoice } from "./availability.ts";
import { entryOf } from "./catalog.ts";
import { readStanding, type StateDependencies } from "./connectorState.ts";
import { hasRealm, readConnectorRecords, readPlacement } from "./connectorStore.ts";

// What a realm's or a quest's panel reads of the connectors (connectors specification, Where a connector is available):
// each installed connector's own choice at that level, and what Inherit would give there.

type Level = ConnectorChoiceLevel;

/** What a level stores and what it inherits, given the stored choices and, for a quest, its placement. */
const choicesAt = (level: Level, choices: ConnectorChoices, placementRealmId: string | null) => {
  if (level._tag === "Borderlands")
    return { choice: choices.borderlands, inherited: "On", inheritedFrom: null } as const;
  if (level._tag === "Realm")
    return { choice: choices.realms.get(level.realmId) ?? null, inherited: "On", inheritedFrom: null } as const;
  // A quest inherits from its placement, which is its realm or else the Borderlands, never both.
  const placement = placementRealmId === null ? choices.borderlands : (choices.realms.get(placementRealmId) ?? null);
  return {
    choice: choices.quests.get(level.missionId) ?? null,
    inherited: (placement ?? "On") satisfies SwitchChoice,
    inheritedFrom: placement === null ? null : placementRealmId === null ? "Borderlands" : "Realm",
  } as const;
};

/** Every installed connector's choice at one level, in install order; one being removed is left out. */
export const choiceCardsOf = Effect.fnUntraced(function* (dependencies: StateDependencies, level: Level) {
  const provided = Effect.provideService(SqlClient.SqlClient, dependencies.sql);
  if (level._tag === "Realm" && !(yield* hasRealm(level.realmId).pipe(provided)))
    return yield* notFound("No such realm.");
  let placementRealmId: string | null = null;
  if (level._tag === "Quest") {
    const placement = yield* readPlacement(level.missionId).pipe(provided);
    if (placement === null) return yield* notFound("No such quest.");
    if (placement.isChronicler)
      return yield* invalid("Chronicler follows each connector's global switch alone: it has no choices of its own.");
    placementRealmId = placement.realmId;
  }
  const cards: Array<ConnectorChoiceCard> = [];
  for (const record of yield* readConnectorRecords.pipe(provided)) {
    const entry = entryOf(dependencies.catalog, record.id);
    if (entry === null || record.isRemoving) continue;
    const standing = yield* readStanding(dependencies, entry, record);
    cards.push({
      ...choicesAt(level, standing.choices, placementRealmId),
      connectorId: entry.id,
      isEnabled: record.isEnabled,
      name: entry.name,
      state: standing.isConnected ? "Ready" : "NeedsConnecting",
    });
  }
  return cards;
});
