import type { MissionId, ThreadId } from "@outlore/contracts";
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { usePaneQuestPanel } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { useQuestPages } from "./questPages";
import { questPanelOf } from "./questPanelOf";
import { ThreadPane } from "./threadPane";

/**
 * One thread's conversation in a pane (CHG-0558): it reads its own thread, so panes side by side each stay current,
 * and it hands the details panel its thread only while it is the pane pressed last. A page the panel opens (the
 * journal, lore, a budget) replaces the conversation of that pane alone.
 */
export function PaneThread({
  chrome,
  client,
  isFocused,
  missionId,
  onOpenMission,
  onOpenThread,
  threadId,
}: {
  /** The fold and close buttons of the pane's header. */
  chrome: ReactNode;
  client: ServiceClient;
  isFocused: boolean;
  missionId: MissionId;
  onOpenMission: (missionId: MissionId) => void;
  /** Opens another thread of the quest: a reply line here opens its errand in the pane beside this one. */
  onOpenThread: (threadId: ThreadId) => void;
  threadId: ThreadId;
}) {
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId },
    `${missionId}:${threadId}:pane`,
  );
  // A query for a newly opened thread answers after the previous one; draw only what matches.
  const detail = data !== null && data.thread.id === threadId ? data : null;
  const pages = useQuestPages(client, missionId, data?.mission.title ?? "");
  usePaneQuestPanel(isFocused, detail && questPanelOf({ client, detail, onSelectThread: onOpenThread, pages }));
  if (isFocused && pages.screen !== null) return <View style={local.page}>{pages.screen}</View>;
  return (
    <View style={local.pane}>
      {error !== null && <Text style={styles.error}>{error}</Text>}
      {detail && (
        <ThreadPane
          canOpenDetails={false}
          chrome={chrome}
          client={client}
          detail={detail}
          isCompact={true}
          isInPane
          key={detail.thread.id}
          onOpenBudget={() => pages.openBudget(detail.budgetStop?.scope ?? "Mission")}
          onOpenDetails={() => {}}
          onOpenMission={onOpenMission}
          onSelect={onOpenThread}
        />
      )}
    </View>
  );
}

const local = StyleSheet.create({
  page: { flex: 1 },
  pane: { flex: 1, gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
});
