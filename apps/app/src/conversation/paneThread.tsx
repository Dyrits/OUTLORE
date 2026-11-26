import type { MissionId, ThreadId, ThreadSummary } from "@outlore/contracts";
import { memo, type ReactNode, useContext, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import type { QuestPage } from "../foundation/pageNavigation";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { RitualCompanions } from "../rituals/ritualCompanions";
import { ChronicleTargetContext, matchesThread } from "./chronicleTarget";
import { ErrandEndingButtons } from "./errandHeaderActions";
import { childErrandsOf } from "./errandRoster";
import { PaneTabs } from "./paneTabs";
import { useQuestPages } from "./questPages";
import { questPanelOf } from "./questPanelOf";
import { NewReplyCard, ReplyLine } from "./replyLine";
import { ThreadPane } from "./threadPane";

/**
 * One thread's conversation in a pane (CHG-0561): it reads its own thread, so panes side by side each stay current,
 * and each owns its tabs and the pages opened from Quest details.
 */
export const PaneThread = memo(function PaneThread({
  chrome,
  client,
  listRequest,
  missionId,
  onBack,
  onOpenMission,
  onNewErrand,
  onOpenThread,
  onStartErrand,
  threadId,
}: {
  /** The fold and close buttons of the pane's header. */
  chrome: ReactNode;
  client: ServiceClient;
  /** Each new request from the sidebar or a notch opens the quest's Errands tab. */
  listRequest?: object | undefined;
  missionId: MissionId;
  onBack?: (() => void) | undefined;
  onOpenMission: (missionId: MissionId) => void;
  /** The header's icon that starts an errand of the quest; none on the quest's own pane. */
  onNewErrand?: (() => void) | undefined;
  /** Opens another thread of the quest: a reply line here opens its errand in the pane beside this one. */
  onOpenThread: (threadId: ThreadId) => void;
  onStartErrand?: (() => void) | undefined;
  threadId: ThreadId;
}) {
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId },
    `${missionId}:${threadId}:pane`,
  );
  // A query for a newly opened thread answers after the previous one; draw only what matches.
  const detail = data !== null && data.thread.id === threadId ? data : null;
  const [tab, setTab] = useState<"Missives" | "Errands" | "Quest" | "Ritual" | "Errand" | "Companions">(
    listRequest === undefined ? "Missives" : "Errands",
  );
  useEffect(() => {
    if (listRequest !== undefined) setTab("Errands");
  }, [listRequest]);
  const target = useContext(ChronicleTargetContext);
  useEffect(() => {
    if (target !== null && matchesThread(target, threadId, detail?.thread.parentId === null)) setTab("Missives");
  }, [target, threadId, detail?.thread.parentId]);
  const isQuest = detail?.thread.parentId === null;
  // The details tab is named for what the pane holds: the quest's own thread, or one of its errands.
  const detailsName = isQuest ? (detail?.mission.ritual === null ? "Quest" : "Ritual") : "Errand";
  const isRitual = detailsName === "Ritual";
  const isDetails = tab === "Quest" || tab === "Ritual" || tab === "Errand";
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
                  {/* A Ritual's runs are its only errands (CHG-0616): none is opened by hand, on a quest it still is. */}
                  {detail.mission.ritual === null && onStartErrand !== undefined && (
                    <NewReplyCard
                      isDisabled={!detail.thread.actions.canOpenBeneath}
                      label="New errand"
                      onPress={onStartErrand}
                    />
                  )}
                  {childErrandsOf(detail.threads, threadId).map((thread) => (
                    <ListedErrand client={client} key={thread.id} onOpen={onOpenThread} thread={thread} />
                  ))}
                </ScrollView>
              ) : isRitual && tab === "Companions" ? (
                <RitualCompanions client={client} missionId={missionId} />
              ) : isDetails ? (
                questPanelOf({ client, detail, onOpenMission, onSelectThread: onOpenThread, pages })
              ) : null
            }
            canOpenDetails={false}
            chrome={chrome}
            client={client}
            {...(!isRitual
              ? {
                  companions: {
                    isSelected: tab === "Companions",
                    onOpen: () => setTab(tab === "Companions" ? "Missives" : "Companions"),
                  },
                }
              : {})}
            detail={detail}
            isCompact={true}
            isInPane
            key={detail.thread.id}
            {...(onBack === undefined ? {} : { onBack })}
            onNewErrand={onNewErrand}
            onOpenBudget={() => pages.openBudget(detail.budgetStop?.scope ?? "Mission")}
            onOpenDetails={() => {}}
            onOpenMission={onOpenMission}
            onSelect={onOpenThread}
            tabs={
              <PaneTabs
                isTouch={onBack !== undefined}
                names={
                  isQuest ? ["Missives", detailsName, "Errands", "Companions"] : ["Missives", "Errand", "Companions"]
                }
                onSelect={setTab}
                selected={isDetails ? detailsName : tab}
              />
            }
          />
        )}
      </View>
    </View>
  );
});

function ListedErrand({
  client,
  onOpen,
  thread,
}: {
  client: ServiceClient;
  onOpen: (threadId: ThreadId) => void;
  thread: ThreadSummary;
}) {
  const [failure, setFailure] = useState<string | null>(null);
  const [isBusy, setBusy] = useState(false);
  const act = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setFailure(null);
    try {
      await work();
    } catch (reason) {
      setFailure(messageOf(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View>
      <ReplyLine
        actions={
          <ErrandEndingButtons
            act={act}
            client={client}
            isDisabled={isBusy}
            isEmpty={thread.isEmpty === true}
            state={thread.state}
            threadId={thread.id}
            title={thread.title}
          />
        }
        onOpen={onOpen}
        thread={thread}
      />
      {failure !== null && (
        <Text accessibilityRole="alert" style={styles.error}>
          {failure}
        </Text>
      )}
    </View>
  );
}

const local = StyleSheet.create({
  hidden: { display: "none" },
  list: { gap: 8 },
  page: { flex: 1 },
  pane: { flex: 1, gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
});
