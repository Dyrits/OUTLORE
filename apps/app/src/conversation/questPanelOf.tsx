import type { MissionDetail, MissionId, ThreadId } from "@outlore/contracts";
import type { ServiceClient } from "../foundation/client";
import type { useQuestPages } from "./questPages";
import { ThreadPanel } from "./threadPanel";

/** The quest's side panel for an open thread, with the pages it opens and the way to the quest's own thread. */
export const questPanelOf = ({
  client,
  detail,
  onOpenMission,
  onSelectThread,
  pages,
}: {
  client: ServiceClient;
  detail: MissionDetail;
  /** Opens another quest, such as the origin quest of a Ritual. */
  onOpenMission: (missionId: MissionId) => void;
  onSelectThread: (threadId: ThreadId) => void;
  pages: ReturnType<typeof useQuestPages>;
}) => (
  <ThreadPanel
    client={client}
    detail={detail}
    key={detail.thread.id}
    onOpenBudget={() => pages.openBudget("Mission")}
    onOpenJournal={pages.openJournal}
    onOpenLore={() => pages.openLore({ id: detail.thread.id, title: detail.thread.title })}
    onOpenMission={onOpenMission}
    onOpenQuest={() => onSelectThread(detail.mission.topThreadId)}
  />
);
