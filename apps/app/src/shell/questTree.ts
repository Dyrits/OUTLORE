import type { MissionSummary, ThreadSummary, WorkspaceChoice } from "@outlore/contracts";
import { errandRowsOf } from "../conversation/errandRoster";
import { latestFirstOf } from "./questRecency";

/** The sidebar's two placements of quests (CHG-0161): each realm with its quests, and the Borderlands' quests. */
export interface Placements {
  /** The quests of no realm: autonomous, with no workspace and no shared lore. */
  readonly borderlands: ReadonlyArray<MissionSummary>;
  readonly realms: ReadonlyArray<{
    readonly quests: ReadonlyArray<MissionSummary>;
    readonly workspace: WorkspaceChoice;
  }>;
}

/**
 * Sorts every quest into its placement (mission-tracking, Left navigation structure): realms by name, whether tied to a
 * folder or not.
 * Quests within each placement are ordered by latest activity, newest first, whatever their status (CHG-0679): status no
 * longer ranks them in the sidebar.
 * A realm with no quest is kept, so it can be found.
 */
export const placementsOf = (
  missions: ReadonlyArray<MissionSummary>,
  workspaces: ReadonlyArray<WorkspaceChoice>,
): Placements => {
  const ranked = latestFirstOf(missions);
  return {
    borderlands: ranked.filter((mission) => mission.workspaceId === null),
    // The service lists realms in the owner's order (dragged in the sidebar), by name for those never placed.
    realms: workspaces.map((workspace) => ({
      quests: ranked.filter((mission) => mission.workspaceId === workspace.id),
      workspace,
    })),
  };
};

/** What the folder icon after a realm's name says on hover: its full path; null where no icon shows, for a realm tied to no folder. */
export const folderCueOf = (realm: Pick<WorkspaceChoice, "path">): string | null =>
  realm.path === null ? null : `Tied to ${realm.path}`;

/**
 * The folded ids after the owner presses a heading, a chevron, or a realm's row: a folded one unfolds, an unfolded one
 * folds, and the others stay as they were. Realms and Borderlands fold this same way (CHG-0161, CHG-0472).
 */
export const toggledFold = (folded: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const next = new Set(folded);
  if (!next.delete(id)) next.add(id);
  return next;
};

/**
 * Whether a sidebar row shows its hover marks (a heading's fold arrow; new quest, new realm): always on a
 * device that cannot hover (a phone, a touch screen), where they could not be found otherwise; elsewhere only while the
 * pointer is over the row, or while a keyboard focus is inside it so they stay reachable. The focus a click leaves does
 * not count. Otherwise they keep their place, unseen.
 */
export const areActionsShown = (row: {
  readonly canHover: boolean;
  readonly hasKeyboardFocusWithin: boolean;
  readonly isHovered: boolean;
}): boolean => !row.canHover || row.isHovered || row.hasKeyboardFocusWithin;

/** One row of the full quest list: the quest at depth 0, or one of its errands beneath it. */
export interface QuestListRow {
  readonly depth: number;
  /** Whether it has errands beneath it, so it can expand and collapse. */
  readonly hasChildren: boolean;
  /** The quest's id for the quest's row, the thread's for an errand's. */
  readonly id: string;
  /** The errand, or null for the quest's own row. */
  readonly thread: ThreadSummary | null;
}

/**
 * The rows the full quest list shows for one quest: the quest, then its errands nested as the sidebar nests them
 * (`errandRowsOf`, with the same setting for agents' threads), unless the quest is collapsed. Its tree is null until read.
 */
export const questListRowsOf = (
  quest: Pick<MissionSummary, "id" | "threadCount">,
  threads: ReadonlyArray<ThreadSummary> | null,
  collapsed: ReadonlySet<string>,
  shouldShowAgentThreads = true,
): ReadonlyArray<QuestListRow> => {
  const own: QuestListRow = { depth: 0, hasChildren: quest.threadCount > 1, id: quest.id, thread: null };
  if (threads === null || collapsed.has(quest.id)) return [own];
  return [
    own,
    ...errandRowsOf(threads, { collapsed, shouldShowAgentThreads }).map(
      ({ depth, hasChildren, thread }): QuestListRow => ({ depth, hasChildren, id: thread.id, thread }),
    ),
  ];
};

/** A realm whose quests the quest list page shows in full. */
export interface RealmListing {
  readonly id: string;
  readonly name: string;
}

/**
 * The order of all realms after one is dropped before or after another. Null for a drop on itself or on an unknown
 * realm, and for a drop that leaves the order as it was.
 */
export const reorderedRealmIds = (
  realms: ReadonlyArray<{ readonly id: string }>,
  movedId: string,
  targetId: string,
  side: "before" | "after",
): ReadonlyArray<string> | null => {
  const moved = realms.find((each) => each.id === movedId);
  if (moved === undefined || realms.every((each) => each.id !== targetId) || movedId === targetId) return null;
  const without = realms.filter((each) => each.id !== movedId);
  const at = without.findIndex((each) => each.id === targetId);
  without.splice(side === "before" ? at : at + 1, 0, moved);
  const order = without.map((each) => each.id);
  return order.every((id, index) => id === realms[index]?.id) ? null : order;
};
