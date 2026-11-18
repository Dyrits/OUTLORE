import type { MissionSummary, WorkspaceId } from "@outlore/contracts";

// Moving a quest to a realm, or out of its realm (mission-tracking, Quest placement and moves): what a move means and
// what the owner is asked to confirm. Nothing here moves a quest; the service does, once the owner confirms.

/** A place a quest can be moved to: a realm, or null id for no realm at all. */
export interface Destination {
  readonly id: WorkspaceId | null;
  readonly name: string;
}

/** No realm, as a destination: the quest is then listed with the realms, in none of them. */
export const noRealmDestination: Destination = { id: null, name: "no realm" };

/** The name of the place a quest stands in now. */
export const sourceNameOf = (mission: Pick<MissionSummary, "workspaceName">): string =>
  mission.workspaceName ?? noRealmDestination.name;

/** What the owner confirms before a move, naming the source and the destination and the change of lore. */
export interface MoveConfirmation {
  readonly body: string;
  readonly title: string;
}

/**
 * The confirmation for moving a quest, or null when it already stands there and nothing changes. The words name only the
 * realm lore the quest loses and the realm lore it gains: a quest in no realm has none to lose or gain.
 */
export const moveConfirmationOf = (
  mission: Pick<MissionSummary, "title" | "workspaceId" | "workspaceName">,
  destination: Destination,
): MoveConfirmation | null => {
  if (mission.workspaceId === destination.id) return null;
  const source = sourceNameOf(mission);
  const lore = [
    mission.workspaceId === null ? null : `The lore shared in ${source} will no longer be available to them.`,
    destination.id === null ? null : `The lore shared in ${destination.name} will be.`,
  ].filter((line) => line !== null);
  return {
    body: [
      destination.id === null
        ? `The quest and all its errands leave ${source} and are in no realm.`
        : `The quest and all its errands move from ${source} to ${destination.name}.`,
      `${lore.join(" ")} Lore is not copied.`,
      "Its conversation, journal, and own lore stay with the quest. Files, edits, and branches stay where they are.",
    ].join("\n\n"),
    title:
      destination.id === null
        ? `Take "${mission.title}" out of ${source}?`
        : `Move "${mission.title}" to ${destination.name}?`,
  };
};
