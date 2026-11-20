import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import type { QuestPage } from "../foundation/pageNavigation";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { PaneTabs } from "./paneTabs";
import { useQuestPages } from "./questPages";
import { questPanelOf } from "./questPanelOf";
import { NewReplyCard, ReplyLine } from "./replyLine";
import { ThreadPane } from "./threadPane";

/**
 * One thread's conversation in a pane (CHG-0561): it reads its own thread, so panes side by side each stay current,
 * and each owns its tabs and the pages opened from Quest details.
 */
export function PaneThread({
  chrome,
  client,
  missionId,
  onOpenMission,
  onOpenThread,
  onStartErrand,
  threadId,
}: {
  /** The fold and close buttons of the pane's header. */
  chrome: ReactNode;
  client: ServiceClient;
  missionId: MissionId;
  onOpenMission: (missionId: MissionId) => void;
  /** Opens another thread of the quest: a reply line here opens its errand in the pane beside this one. */
  onOpenThread: (threadId: ThreadId) => void;
  onStartErrand: () => void;
  threadId: ThreadId;
}) {
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId },
    `${missionId}:${threadId}:pane`,
  );
  // A query for a newly opened thread answers after the previous one; draw only what matches.
  const detail = data !== null && data.thread.id === threadId ? data : null;
  const [tab, setTab] = useState<"Missives" | "Errands" | "Quest" | "Companions">("Missives");
  const isQuest = detail?.thread.parentId === null;
  const [page, setPage] = useState<QuestPage>(null);
  const pages = useQuestPages(client, missionId, data?.mission.title ?? "", { onPage: setPage, page });

  return (
    <View style={local.pane}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {pages.screen}
      <View style={pages.screen === null ? local.page : local.hidden}>
        {detail && (
          <ThreadPane
            alternateBody={
              isQuest && tab === "Errands" ? (
                <ScrollView contentContainerStyle={local.list} style={local.page}>
                  <NewReplyCard
                    isDisabled={!detail.thread.actions.canOpenBeneath}
                    label="New errand"
                    onPress={onStartErrand}
                  />
                  {detail.threads
                    .filter((thread) => thread.parentId === threadId)
                    .map((thread) => (
                      <ReplyLine key={thread.id} onOpen={onOpenThread} thread={thread} />
                    ))}
                </ScrollView>
              ) : tab === "Quest" ? (
                questPanelOf({ client, detail, onSelectThread: onOpenThread, pages })
              ) : null
            }
            canOpenDetails={false}
            chrome={chrome}
            client={client}
            companions={{ isSelected: tab === "Companions", onOpen: () => setTab("Companions") }}
            detail={detail}
            isCompact={true}
            isInPane
            key={detail.thread.id}
            onOpenBudget={() => pages.openBudget(detail.budgetStop?.scope ?? "Mission")}
            onOpenDetails={() => {}}
            onOpenMission={onOpenMission}
            onSelect={onOpenThread}
            tabs={
              <PaneTabs
                names={isQuest ? ["Missives", "Errands", "Quest", "Companions"] : ["Missives", "Quest", "Companions"]}
                onSelect={setTab}
                selected={tab}
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  hidden: { display: "none" },
  list: { gap: 8 },
  page: { flex: 1 },
  pane: { flex: 1, gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
});
