import type { MissionSummary } from "@outlore/contracts";

/** Whether a mission is an ordinary quest or a scheduled Ritual (CHG-0616). */
export type MissionKind = "Quest" | "Ritual";

/** The kind of a mission summary: Ritual when it carries a Ritual card, otherwise Quest. */
export const missionKindOf = (mission: MissionSummary): MissionKind => (mission.ritual === null ? "Quest" : "Ritual");

/**
 * The missions of one kind that a realm holds (null for the Borderlands), in the order the service gave.
 * Rank them with `latestFirstOf` for a list.
 */
export const inRealmOf = (
  missions: ReadonlyArray<MissionSummary>,
  realmId: string | null,
  kind: MissionKind,
): MissionSummary[] => missions.filter((mission) => mission.workspaceId === realmId && missionKindOf(mission) === kind);
