import type { MissionId } from "@outlore/contracts";
import { createContext, useContext } from "react";

/** What the Ritual form opened over the conversation area works on (CHG-0643): a new Ritual, or one to edit. */
export type RitualFormTarget =
  /** A new Ritual: in the realm of its "+ Ritual", or of the quest it is scheduled from, when there is one. */
  | { kind: "create"; originMissionId: MissionId | null; realmPath: string | null }
  /** The Ritual whose mission is named; editing keeps its realm, and the form leaves it to the saved one. */
  | { kind: "edit"; missionId: MissionId };

/** Opening the middle-panel Ritual form, owned by the window's location. */
export const RitualFormNavigation = createContext<{ open: (target: RitualFormTarget) => void }>({
  open: () => {},
});

/** Tells the window to open the Ritual form over the conversation area. */
export const useRitualFormNavigation = () => useContext(RitualFormNavigation);
