import type { MissionId, Viewing } from "@outlore/contracts";
import type { Place } from "./sidebar";

// Where the owner has Chronicler open from (quest coordination, Context): the screen's name as the owner knows it, and the
// quest when the screen is one. Chronicler reads it with each message, to know what "this quest" or "this page" means.

/** The names of the screens, as the sidebar and the top bar call them. */
const screenNames: Record<Place, string> = {
  Archived: "Archive",
  Borderlands: "Borderlands quests",
  Charter: "Charter",
  Craft: "Craft",
  Guildmaster: "Guild Hall",
  Library: "Library",
  Lore: "Lore",
  Quests: "Quest board",
  RealmQuests: "Realm quests",
  Realms: "Realms",
  Reserves: "Reserves",
  Rituals: "Rituals",
  Settings: "Settings",
};

/** What Chronicler is told: itself when expanded, else the quest or screen beside it. */
export const viewingOf = (
  place: Place | null,
  openMission: MissionId | null,
  listedRealmName: string | null,
  isChroniclerFull = false,
): Viewing => {
  if (isChroniclerFull) return { screen: "Chronicler" };
  if (openMission !== null) return { missionId: openMission, screen: "Quest" };
  if (place === null) return { screen: "App" };
  return {
    screen: place === "RealmQuests" && listedRealmName !== null ? `Quests of ${listedRealmName}` : screenNames[place],
  };
};
