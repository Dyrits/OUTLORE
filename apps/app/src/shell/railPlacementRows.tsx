import type { MissionSummary } from "@outlore/contracts";
import type { ComponentProps } from "react";
import { Quest, RitualRow } from "./railQuests";
import { Divider } from "./railRows";

/** Draws a placement's quests, then its Rituals, each group in the order the roster ranked it. */
export function PlacementRows({
  quests,
  questProps,
  isQuestOpen,
  realms,
  rituals,
}: {
  quests: readonly MissionSummary[];
  rituals: readonly MissionSummary[];
  questProps: Omit<ComponentProps<typeof Quest>, "isOpen" | "mission">;
  isQuestOpen: (id: string) => boolean;
  realms: ComponentProps<typeof RitualRow>["realms"];
}) {
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
