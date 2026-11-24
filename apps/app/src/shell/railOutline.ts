import type { Placements } from "./questTree";
import { type PlacementRoster, rosterOf } from "./realmRoster";

/** The normal sidebar quota of quests for each realm and for quests in no realm. */
const sidebarQuestLimit = 4;

/** Placement rosters with the current quest revealed, ready for the rail to draw. */
export const railOutlineOf = (
  placements: Placements,
  openMission: string | null,
  openQuests: ReadonlySet<string>,
  limit = sidebarQuestLimit,
) => {
  const rosterOfPlacement = (missions: Placements["borderlands"]): PlacementRoster =>
    rosterOf(missions, { openMission, questLimit: limit });
  return {
    borderlands: rosterOfPlacement(placements.borderlands),
    isQuestOpen: (id: string) => openQuests.has(id),
    realms: placements.realms.map((realm) => ({ ...realm, roster: rosterOfPlacement(realm.quests) })),
  };
};
