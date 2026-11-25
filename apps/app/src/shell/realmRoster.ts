import type { MissionSummary } from "@outlore/contracts";
import { inRealmOf, type MissionKind, missionKindOf } from "../foundation/realmFilter";
import { latestFirstOf } from "./questRecency";

export { inRealmOf, type MissionKind };

/**
 * The realm roster: a placement's quests and Rituals as two separate ranked groups, each with its preview and its count.
 * The split comes before the cut and the count, so a Ritual takes no quest slot and "Show all N quests" counts quests.
 * Rituals are the quests of a placement that carry a Ritual card (CHG-0616).
 */

/** One group of a placement: every mission ranked, the preview cut from it, and how many there are. */
export interface RankedMissions {
  readonly count: number;
  readonly preview: ReadonlyArray<MissionSummary>;
  readonly ranked: ReadonlyArray<MissionSummary>;
}

/** A placement's quests and Rituals, ranked apart. */
export interface PlacementRoster {
  readonly quests: RankedMissions;
  readonly rituals: RankedMissions;
}

/** Whether a placement holds no quest and no Ritual. */
export const isRosterEmpty = (roster: PlacementRoster): boolean => roster.quests.count + roster.rituals.count === 0;

/** Keeps the open mission in the preview and fills the remaining slots in rank order. */
const previewOf = (ranked: ReadonlyArray<MissionSummary>, limit: number, openMission: string | null) => {
  if (ranked.length <= limit) return ranked;
  const byPriority = [
    ...ranked.filter((mission) => mission.id === openMission),
    ...ranked.filter((mission) => mission.id !== openMission),
  ];
  const visible = new Set(byPriority.slice(0, limit));
  return ranked.filter((mission) => visible.has(mission));
};

/**
 * Splits a placement's missions into quests and Rituals, ranks each by latest activity (CHG-0679), and cuts each preview.
 * The sidebar has no way yet to open the Rituals list, so Rituals are not cut unless a limit is given.
 */
export const rosterOf = (
  missions: ReadonlyArray<MissionSummary>,
  options: { readonly openMission: string | null; readonly questLimit: number; readonly ritualLimit?: number },
): PlacementRoster => {
  const groupOf = (kind: MissionKind, limit: number): RankedMissions => {
    const ranked = latestFirstOf(missions.filter((mission) => missionKindOf(mission) === kind));
    return { count: ranked.length, preview: previewOf(ranked, limit, options.openMission), ranked };
  };
  return {
    quests: groupOf("Quest", options.questLimit),
    rituals: groupOf("Ritual", options.ritualLimit ?? Number.POSITIVE_INFINITY),
  };
};
