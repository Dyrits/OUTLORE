import type { MissionId, ThreadId } from "@outlore/contracts";
import { memo, useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import type { QuestTabMemory } from "../conversation/questTabMemory";
import type { ServiceClient } from "../foundation/client";
import { colors } from "../foundation/theme";
import { ExpandPaneButton, FoldPaneButton } from "../ui/questHeaderButtons";
import { channelId, type PaneId } from "./paneIds";

/**
 * One thread's island in the pane row: every prop is a value or a callback that keeps its identity,
 * so the pane renders again only when its own conversation or its own layout changes, never for a neighbor's.
 */
export const ThreadSlot = memo(function ThreadSlot({
  client,
  expandPane,
  fold,
  hasMultiplePanes,
  isFocused,
  isQuest,
  listRequest,
  missionId,
  onOpenList,
  onOpenMission,
  questId,
  revealThread,
  setFocused,
  startErrand,
  tabMemory,
  threadId,
}: {
  client: ServiceClient;
  expandPane: (id: ThreadId) => void;
  fold: (id: ThreadId) => void;
  hasMultiplePanes: boolean;
  isFocused: boolean;
  isQuest: boolean;
  listRequest: object | undefined;
  missionId: MissionId;
  /** Opens a pane's list tab: the channel's Quests, or a quest's Errands; the same as the notches beside the panes. */
  onOpenList: (id: PaneId) => void;
  onOpenMission: (missionId: MissionId) => void;
  /** The quest's own thread, which an errand pane's New errand icon starts an errand under. */
  questId: ThreadId | null;
  revealThread: (threadId: ThreadId) => void;
  setFocused: (id: ThreadId) => void;
  startErrand: (questId: ThreadId) => void;
  /** The tab the last quest's pane showed, given to a quest's pane only: an errand's tabs are its own. */
  tabMemory: QuestTabMemory;
  threadId: ThreadId;
}) {
  const chrome = useMemo(
    () =>
      hasMultiplePanes ? (
        <>
          <ExpandPaneButton onPress={() => expandPane(threadId)} />
          <FoldPaneButton label={isQuest ? "Fold the quest" : "Fold the errand"} onPress={() => fold(threadId)} />
        </>
      ) : null,
    [expandPane, fold, hasMultiplePanes, isQuest, threadId],
  );
  const onNewErrand = useMemo(
    () => (!isQuest && questId !== null ? () => startErrand(questId) : void 0),
    [isQuest, questId, startErrand],
  );
  // The title leads to the parent's tab: a quest's Quests tab in the channel, an errand's Errands tab in its quest.
  const parentId: PaneId | null = isQuest ? channelId : questId;
  const onShowParent = useMemo(() => (parentId === null ? void 0 : () => onOpenList(parentId)), [onOpenList, parentId]);
  const onStartErrand = useCallback(() => startErrand(threadId), [startErrand, threadId]);
  const onPointerDown = useCallback(() => setFocused(threadId), [setFocused, threadId]);
  return (
    <View onPointerDown={onPointerDown} style={[local.content, isFocused && hasMultiplePanes && local.focused]}>
      <PaneThread
        chrome={chrome}
        client={client}
        listRequest={listRequest}
        missionId={missionId}
        onNewErrand={onNewErrand}
        onOpenMission={onOpenMission}
        onOpenThread={revealThread}
        {...(onShowParent === undefined ? {} : { onShowParent })}
        onStartErrand={onStartErrand}
        tabMemory={isQuest ? tabMemory : void 0}
        threadId={threadId}
      />
    </View>
  );
});

const local = StyleSheet.create({
  content: { flex: 1 },
  focused: { backgroundColor: colors.page },
});
