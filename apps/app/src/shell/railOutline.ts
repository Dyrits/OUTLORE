import type { MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { ancestorIdsOf, type Placements, sideQuestRowsOf } from "./questTree";

/** The normal sidebar quota for each realm and for quests in no realm. */
const sidebarQuestLimit = 5;

/**
 * Keeps the open quest and every running quest visible beyond a placement's normal row limit, each in its place in the
 * list (the open quest is kept whatever its state; running quests are kept so the owner always sees what works).
 */
export const visibleQuestsOf = (quests: readonly MissionSummary[], limit: number, openMission: string | null) =>
  quests.filter((quest, index) => index < limit || quest.id === openMission || quest.state === "Underway");

/** Reveals the location's ancestors without modifying the owner's saved folds. */
export const threadOutlineOf = (
  threads: readonly ThreadSummary[],
  collapsed: ReadonlySet<string>,
  selectedThread: ThreadId | null,
  shouldShowAgentThreads: boolean,
) => {
  const ancestors = new Set<string>(selectedThread === null ? [] : ancestorIdsOf(threads, selectedThread));
  const folds = new Set([...collapsed].filter((id) => !ancestors.has(id)));
  return { collapsed: folds, rows: sideQuestRowsOf(threads, { collapsed: folds, shouldShowAgentThreads }) };
};

/** Placement rows with the current quest revealed, ready for the rail to draw. */
export const railOutlineOf = (
  placements: Placements,
  openMission: string | null,
  openQuests: ReadonlySet<string>,
  limit = sidebarQuestLimit,
) => ({
  borderlands: visibleQuestsOf(placements.borderlands, limit, openMission),
  isQuestOpen: (id: string) => openQuests.has(id),
  realms: placements.realms.map((realm) => ({
    ...realm,
    visibleQuests: visibleQuestsOf(realm.quests, limit, openMission),
  })),
});
