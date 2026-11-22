import type { MissionId, ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { useHasSidebar, useHasTopBar, useQuestPanel } from "../foundation/shellContext";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { MobileHeader } from "./mobileHeader";
import { useQuestPages } from "./questPages";
import { questPanelOf } from "./questPanelOf";
import { ThreadPane } from "./threadPane";
import { ThreadTree } from "./threadTree";
import { useShownThreadsRead } from "./useShownThreadsRead";

/** A mission: its thread tree on the side, the selected thread's conversation beside it. */
export function Conversation({
  client,
  initiallyShowErrands = false,
  missionId,
  onBack,
  onOpenMission,
  onSelectThread,
  onSetDetails,
  selectedThreadId,
}: {
  client: ServiceClient;
  initiallyShowErrands?: boolean;
  missionId: MissionId;
  /** Shows another thread of this quest; the window keeps which one, so the sidebar can show it too. */
  onSelectThread: (threadId: ThreadId | null) => void;
  /** The thread shown, or null for the quest's top thread. */
  selectedThreadId: ThreadId | null;
  /** Opens or closes the quest's side panel. */
  onSetDetails: (isOpen: boolean) => void;
  /** Goes to the quest's parent view: its realm's quests, or the Borderlands; null while the quest has not loaded. */
  onBack: (quest: { workspaceId: string | null; workspaceName: string | null } | null) => void;
  /** Opens another mission, such as where an off-topic request went. */
  onOpenMission: (missionId: MissionId) => void;
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 820;
  // On a narrow window the errands list is folded to one line until it is wanted, so the conversation keeps the room.
  const [isTreeOpen, setIsTreeOpen] = useState(initiallyShowErrands);
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const selectedId = selectedThreadId;
  const setSelectedId = onSelectThread;
  const hasTopBar = useHasTopBar();
  const hasSidebar = useHasSidebar();
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId: selectedId },
    `${missionId}:${selectedId ?? "top"}`,
  );
  const goBack = () => onBack(data?.mission ?? null);
  const pages = useQuestPages(client, missionId, data?.mission.title ?? "");
  // A query for a newly selected thread answers after the previous one; keep showing what matches.
  const detail = data !== null && (selectedId === null || data.thread.id === selectedId) ? data : null;
  // The quest's side panel is shown by the window's frame, beside the top bar's icon, not by this screen. It holds
  // the open thread's groups too: while another thread loads, the one before stays.
  const shown = detail ?? data;
  // The conversation on show is read (CHG-0569): its replies, results and requests are no longer unread.
  const shownId = shown?.thread.id ?? null;
  useShownThreadsRead(client, shownId === null ? [] : [shownId], true);
  const hasSideQuests = data?.threads.some((thread) => thread.parentId !== null) ?? false;
  useQuestPanel(shown && questPanelOf({ client, detail: shown, onOpenMission, onSelectThread: setSelectedId, pages }));
  if (pages.screen !== null) return pages.screen;
  return (
    <View style={[styles.questLayout, isCompact && styles.questLayoutCompact]}>
      {hasSideQuests && !hasSidebar && (
        // With the sidebar showing, it is the quest's one tree; this one serves the narrow window, which has none.
        <View style={[styles.questSide, isCompact && styles.questSideCompact]}>
          <View style={styles.questSideBar}>
            {isCompact && (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: isTreeOpen }}
                onPress={() => setIsTreeOpen(!isTreeOpen)}
              >
                <Text style={styles.link}>Errands {isTreeOpen ? "▴" : "▾"}</Text>
              </Pressable>
            )}
          </View>
          {data && (!isCompact || isTreeOpen) && (
            <ThreadTree
              onSelect={(threadId) => {
                setIsTreeOpen(false);
                setSelectedId(threadId);
              }}
              selectedId={data.thread.id}
              shouldShowAgentThreads={settings?.shouldShowAgentThreads ?? true}
              threads={data.threads}
            />
          )}
        </View>
      )}
      <View style={[styles.questMain, isCompact && styles.questMainCompact]}>
        {!hasSidebar && detail === null && <MobileHeader actions={null} onBack={goBack} title={null} />}
        {error !== null && <Text style={styles.error}>{error}</Text>}
        {detail && (
          <ThreadPane
            canOpenDetails={!hasTopBar}
            client={client}
            detail={detail}
            isCompact={isCompact}
            key={detail.thread.id}
            {...(hasSidebar ? {} : { onBack: goBack })}
            onOpenBudget={() => pages.openBudget(detail.budgetStop?.scope ?? "Mission")}
            onOpenDetails={() => onSetDetails(true)}
            onOpenMission={onOpenMission}
            onSelect={setSelectedId}
          />
        )}
      </View>
    </View>
  );
}
