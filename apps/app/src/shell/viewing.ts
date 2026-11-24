import type { MissionId, Viewing } from "@outlore/contracts";
import { type Place, screenNames } from "./placeCatalog";

// Where the owner has Chronicler open from (quest coordination, Context): the screen's name as the owner knows it, and the
// quest when the screen is one. Chronicler reads it with each message, to know what "this quest" or "this page" means.

/** What Chronicler is told: the quest or screen beside the Chronicle. */
export const viewingOf = (place: Place | null, openMission: MissionId | null): Viewing => {
  if (openMission !== null) return { missionId: openMission, screen: "Quest" };
  if (place === null) return { screen: "App" };
  return { screen: screenNames[place] };
};
