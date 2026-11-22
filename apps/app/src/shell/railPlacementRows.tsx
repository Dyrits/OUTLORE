import type { MissionSummary } from "@outlore/contracts";
import type { ComponentProps } from "react";
import { Quest, RitualRow } from "./railQuests";
import { Divider } from "./railRows";

/** Draw the visible rows of a realm or the Borderlands, in their existing order within each group. */
export function PlacementRows({
  missions,
  questProps,
  isQuestOpen,
  realms,
}: {
  missions: readonly MissionSummary[];
  questProps: Omit<ComponentProps<typeof Quest>, "isOpen" | "mission">;
  isQuestOpen: (id: string) => boolean;
  realms: ComponentProps<typeof RitualRow>["realms"];
}) {
  const quests = missions.filter((mission) => mission.ritual === null);
  const rituals = missions.filter((mission) => mission.ritual !== null);
  return (
    <>
      {quests.map((mission) => (
        <Quest {...questProps} isOpen={isQuestOpen(mission.id)} key={mission.id} mission={mission} />
      ))}
      {quests.length > 0 && rituals.length > 0 && <Divider isPlain />}
      {rituals.map((mission) => (
        <RitualRow
          {...questProps}
          isOpen={isQuestOpen(mission.id)}
          key={mission.id}
          mission={mission}
          realms={realms}
        />
      ))}
    </>
  );
}
