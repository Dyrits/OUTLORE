import type { MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { ancestorIdsOf, type Placements, sideQuestRowsOf } from "./questTree";

/** The normal sidebar quota for each realm and for quests in no realm. */
const sidebarQuestLimit = 4;
const sidebarErrandLimit = 2;

/** Keeps the open quest in the preview and fills remaining slots in placement order. */
const visibleQuestsOf = (quests: readonly MissionSummary[], limit: number, openMission: string | null) => {
  if (quests.length <= limit) return quests;
  const byPriority = [
    ...quests.filter((quest) => quest.id === openMission),
    ...quests.filter((quest) => quest.id !== openMission),
  ];
  const visible = new Set(byPriority.slice(0, limit));
  return quests.filter((quest) => visible.has(quest));
};

/** Reveals the location's ancestors and previews the first two unfolded errand rows. */
export const threadOutlineOf = (
  threads: readonly ThreadSummary[],
  collapsed: ReadonlySet<string>,
  selectedThread: ThreadId | null,
  shouldShowAgentThreads: boolean,
) => {
  const ancestors = new Set<string>(selectedThread === null ? [] : ancestorIdsOf(threads, selectedThread));
  const folds = new Set([...collapsed].filter((id) => !ancestors.has(id)));
  const rows = sideQuestRowsOf(threads, { collapsed: folds, shouldShowAgentThreads });
  return {
    collapsed: folds,
    overflowLabel: rows.length > sidebarErrandLimit ? `Show ${rows.length} errands` : null,
    rows: rows.slice(0, sidebarErrandLimit),
  };
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
