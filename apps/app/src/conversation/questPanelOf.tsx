import type { MissionDetail, ThreadId } from "@outlore/contracts";
import type { ServiceClient } from "../foundation/client";
import type { useQuestPages } from "./questPages";
import { ThreadPanel } from "./threadPanel";

/** The quest's side panel for an open thread, with the pages it opens and the way to the quest's own thread. */
export const questPanelOf = ({
  client,
  detail,
  onSelectThread,
  pages,
}: {
  client: ServiceClient;
  detail: MissionDetail;
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
    onOpenQuest={() => onSelectThread(detail.mission.topThreadId)}
  />
);
