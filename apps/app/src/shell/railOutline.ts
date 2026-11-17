import type { MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { ancestorIdsOf, type Placements, sideQuestRowsOf } from "./questTree";

/** Keeps the open quest visible beyond a placement's normal row limit. */
export const visibleQuestsOf = (quests: readonly MissionSummary[], limit: number, openMission: string | null) =>
  quests.filter((quest, index) => index < limit || quest.id === openMission);

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
  limit: number,
) => ({
  borderlands: visibleQuestsOf(placements.borderlands, limit, openMission),
  isQuestOpen: (id: string) => openQuests.has(id) || id === openMission,
  realms: placements.realms.map((realm) => ({
    ...realm,
    visibleQuests: visibleQuestsOf(realm.quests, limit, openMission),
  })),
});
