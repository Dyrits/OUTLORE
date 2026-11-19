import type { MissionSummary } from "@outlore/contracts";

export { agoOf } from "../foundation/formatting";

/** The quests, the one with the latest activity first; `[...]` copies the list, since sorting changes it in place. */
export const latestFirstOf = (missions: ReadonlyArray<MissionSummary>): Array<MissionSummary> =>
  [...missions].sort((current, next) => next.lastActivityAt - current.lastActivityAt);

/** A run of quests that were last active in the same stretch of time, under one heading. */
export interface RecencyGroup {
  readonly heading: string;
  readonly quests: ReadonlyArray<MissionSummary>;
}

const dayMillis = 24 * 60 * 60 * 1000;

/**
 * Groups quests, latest first, under Today, Yesterday, This week, then one heading per month (with the year when it is
 * not the current one), as the quest list pages list them.
 */
export const recencyGroupsOf = (missions: ReadonlyArray<MissionSummary>, now: number): ReadonlyArray<RecencyGroup> => {
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const thisYear = new Date(now).getFullYear();
  const headingOf = (millis: number) => {
    if (millis >= startOfToday) return "Today";
    if (millis >= startOfToday - dayMillis) return "Yesterday";
    if (millis >= startOfToday - 6 * dayMillis) return "This week";
    const date = new Date(millis);
    const month = date.toLocaleString("en", { month: "long" });
    return date.getFullYear() === thisYear ? month : `${month} ${date.getFullYear()}`;
  };
  const groups: Array<{ heading: string; quests: MissionSummary[] }> = [];
  for (const mission of latestFirstOf(missions)) {
    const heading = headingOf(mission.lastActivityAt);
    const last = groups[groups.length - 1];
    if (last?.heading === heading) last.quests.push(mission);
    else groups.push({ heading, quests: [mission] });
  }
  return groups;
};
