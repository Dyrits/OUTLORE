import type { MissionId, MissionSummary, ThreadId } from "@outlore/contracts";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { canHover } from "../foundation/inputModality";
import { colors } from "../foundation/theme";
import { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { EndingConfirmation } from "../quests/missionActions";
import { DragSource } from "./questDrag";
import {
  ArchiveIcon,
  Chevron,
  DeleteIcon,
  FolderCue,
  NewQuestIcon,
  OverviewButton,
  useRowActions,
} from "./railActions";
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
            fold={{
              isOpen: !outline.collapsed.has(thread.id),
              label: thread.title,
              onPress: hasChildren ? () => onToggle(thread.id) : null,
            }}
            indent={depth * indentStep}
            isSelected={selectedThread === thread.id}
            label={foldedCount > 0 ? `${thread.title} +${foldedCount}` : thread.title}
            leading={<StateDot state={thread.state} />}
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
  // An archive from the sidebar leaves the current view alone unless this quest is the one open.
  const ending = useEnding(client, mission, isHere);
  const label = mission.isEmpty ? `Delete ${mission.title}` : `Archive ${mission.title}`;
  return (
    <>
      {/* Only the quest's own row is picked up; its errands go with it. */}
      <DragSource missionId={mission.id}>
        <Row
          fold={{
            isOpen,
            label: mission.title,
            onPress: mission.threadCount > 1 ? () => onToggle(mission.id) : null,
          }}
          // On hover or focus the archive or delete mark shows at the row's end, in a place kept while unseen. A device that
          // cannot hover has none: there the quest's header holds the archive button.
          hoverAccessory={(isShown) =>
            canHover && (
              <View style={[local.questMark, !isShown && local.actionsHidden]}>
                <Pressable
                  accessibilityLabel={label}
                  accessibilityRole="button"
                  disabled={ending.isBusy || !isShown}
                  hitSlop={6}
                  onPress={() => ending.start("Archived")}
                >
                  {mission.isEmpty ? <DeleteIcon color={colors.textMuted} /> : <ArchiveIcon color={colors.textMuted} />}
                </Pressable>
              </View>
            )
          }
          isSelected={isHere && (openThread === null || openThread === mission.topThreadId)}
          label={mission.title}
          leading={<StateDot state={mission.state} />}
          onPress={() => onOpenMission(mission.id)}
        />
      </DragSource>
      {(ending.pending !== null || ending.error !== null) && (
        <View style={{ paddingLeft: chevronWidth }}>
          <EndingConfirmation ending={ending} />
          {ending.error !== null && <Text style={local.questError}>{ending.error}</Text>}
        </View>
      )}
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
 * always; its overview and new-quest buttons while hovered or focused, and always on a device that cannot hover (CHG-0497).
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
      style={(state) => [
        local.row,
        !canHover && local.rowTouch,
        { paddingLeft: 6 },
        (state.pressed || isHovered(state)) && local.rowHovered,
      ]}
    >
      <FolderCue path={path} />
      <Text numberOfLines={1} style={[local.rowText, local.realmText]}>
        {name}
      </Text>
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
