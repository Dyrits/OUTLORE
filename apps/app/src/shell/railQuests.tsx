import type { MissionId, MissionSummary, ThreadId } from "@outlore/contracts";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { DragSource } from "./questDrag";
import { Chevron, FolderCue, NewQuestIcon, OverviewButton, useRowActions } from "./railActions";
import { threadOutlineOf } from "./railOutline";
import { Count, Row, StateDot } from "./railRows";
import { chevronWidth, indentStep, isHovered, local } from "./railStyles";

/** A quest's errands, nested beneath it with their branch guides; each can collapse its own errands. */
function SideQuests({
  client,
  collapsed,
  missionId,
  onOpenThread,
  onToggle,
  selectedThread,
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  missionId: MissionId;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onToggle: (id: string) => void;
  /** The thread open in this quest, or null when the quest itself or another quest is open. */
  selectedThread: ThreadId | null;
  shouldShowAgentThreads: boolean;
}) {
  const { data: threads } = useServiceQuery(client, { _tag: "ReadThreadTree", missionId }, `${missionId}:tree`);
  if (threads === null) return null;
  const outline = threadOutlineOf(threads, collapsed, selectedThread, shouldShowAgentThreads);
  const { rows } = outline;
  return (
    <>
      {rows.map(({ depth, foldedCount, hasChildren, thread }) => (
        <View key={thread.id}>
          {Array.from({ length: depth }, (_, level) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: the guides of a row are told apart by their level
              key={level}
              pointerEvents="none"
              style={[local.guide, { left: chevronWidth / 2 + level * indentStep }]}
            />
          ))}
          <Row
            accessory={<StateDot state={thread.state} />}
            fold={{
              isOpen: !outline.collapsed.has(thread.id),
              label: thread.title,
              onPress: hasChildren ? () => onToggle(thread.id) : null,
            }}
            indent={depth * indentStep}
            isSelected={selectedThread === thread.id}
            label={foldedCount > 0 ? `${thread.title} +${foldedCount}` : thread.title}
            onPress={() => onOpenThread(missionId, thread.id)}
            textStyle={local.sideQuestText}
          />
        </View>
      ))}
    </>
  );
}

/** One quest of a placement, with its errands beneath it while it is expanded. */
export function Quest({
  client,
  collapsed,
  isOpen,
  mission,
  onOpenMission,
  onOpenThread,
  onToggle,
  onToggleThread,
  openMission,
  openThread,
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  isOpen: boolean;
  mission: MissionSummary;
  onOpenMission: (id: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onToggle: (id: string) => void;
  onToggleThread: (id: string) => void;
  openMission: MissionId | null;
  openThread: ThreadId | null;
  shouldShowAgentThreads: boolean;
}) {
  const isHere = openMission === mission.id;
  return (
    <>
      {/* Only the quest's own row is picked up; its errands go with it. */}
      <DragSource missionId={mission.id}>
        <Row
          accessory={<StateDot state={mission.state} />}
          fold={{
            isOpen,
            label: mission.title,
            onPress: mission.threadCount > 1 ? () => onToggle(mission.id) : null,
          }}
          indent={chevronWidth}
          isSelected={isHere && (openThread === null || openThread === mission.topThreadId)}
          label={mission.title}
          onPress={() => onOpenMission(mission.id)}
        />
      </DragSource>
      {isOpen && mission.threadCount > 1 && (
        <View style={{ paddingLeft: chevronWidth }}>
          <SideQuests
            client={client}
            collapsed={collapsed}
            missionId={mission.id}
            onOpenThread={onOpenThread}
            onToggle={onToggleThread}
            selectedThread={isHere ? openThread : null}
            shouldShowAgentThreads={shouldShowAgentThreads}
          />
        </View>
      )}
    </>
  );
}

/**
 * A realm's row: its name with the folder mark when it is tied to a folder, its quest count, and its chevron,
 * always; its overview and new-quest buttons only while hovered or focused.
 */
export function RealmHeader({
  isOpen,
  name,
  onNewQuest,
  onOverview,
  onToggle,
  path,
  questCount,
}: {
  isOpen: boolean;
  name: string;
  onNewQuest: () => void;
  onOverview: () => void;
  onToggle: () => void;
  path: string | null;
  questCount: number;
}) {
  const { actionsStyle, focusProps, isShown, rowProps } = useRowActions();
  return (
    <Pressable
      {...rowProps}
      accessibilityLabel={name}
      accessibilityRole="button"
      onPress={onToggle}
      style={(state) => [local.row, { paddingLeft: 6 }, (state.pressed || isHovered(state)) && local.rowHovered]}
    >
      <Text numberOfLines={1} style={[local.rowText, local.realmText]}>
        {name}
      </Text>
      <FolderCue path={path} />
      <Chevron focusProps={focusProps} isOpen={isOpen} isShown={isShown} label={name} onPress={onToggle} />
      <View style={local.realmTextEnd} />
      <Count isShown={isShown} value={questCount} />
      <View style={actionsStyle}>
        <OverviewButton focusProps={focusProps} label={name} onPress={onOverview} />
        <Pressable
          {...focusProps}
          accessibilityLabel={`New quest in ${name}`}
          accessibilityRole="button"
          hitSlop={4}
          onPress={onNewQuest}
          style={(state) => [local.newQuest, (state.pressed || isHovered(state)) && local.newQuestHovered]}
        >
          <NewQuestIcon color={colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}
