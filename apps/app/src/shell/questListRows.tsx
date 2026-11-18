import type { MissionId, MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import { colors, fontSizes, fonts, radii, stateLabels, stateTones, yourTurnColor } from "../foundation/theme";
import { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { EndingConfirmation } from "../quests/missionActions";
import { agoOf, questListRowsOf } from "./questTree";
import { ArchiveIcon, DeleteIcon } from "./railActions";

/** The shared compact quest and errand row, indented beneath its parent. */
function QuestLine({
  depth,
  harness,
  isOpen,
  isYourTurn,
  lastActivityAt,
  model,
  now,
  onArchive,
  onOpen,
  onToggle,
  state,
  title,
}: {
  depth: number;
  harness: MissionSummary["harness"];
  isOpen: boolean;
  isYourTurn: boolean;
  lastActivityAt: number;
  model: MissionSummary["model"];
  now: number;
  /** The quest's archive (or delete) button at the row's end; null on an errand's row. */
  onArchive: { isBusy: boolean; isEmpty: boolean; label: string; press: () => void } | null;
  onOpen: () => void;
  onToggle: (() => void) | null;
  state: keyof typeof stateTones;
  title: string;
}) {
  const tone = stateTones[state];
  return (
    <Pressable
      accessibilityLabel={title}
      accessibilityRole="button"
      onPress={onOpen}
      style={(pressed: { pressed: boolean; hovered?: boolean }) => [
        local.line,
        { paddingLeft: 4 + depth * 18 },
        (pressed.pressed || pressed.hovered) && local.lineHovered,
      ]}
    >
      {onToggle === null ? (
        <View style={local.fold} />
      ) : (
        <Pressable
          accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          hitSlop={6}
          onPress={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          style={local.fold}
        >
          <Text style={[local.foldMark, isOpen && local.foldMarkOpen]}>›</Text>
        </Pressable>
      )}
      <View
        accessibilityLabel={stateLabels[state]}
        style={[local.dot, { backgroundColor: isYourTurn ? yourTurnColor : tone.color }]}
      />
      <Text numberOfLines={1} style={local.title}>
        {title}
      </Text>
      <Text numberOfLines={1} style={local.meta}>
        {harnessLabels[harness]} · {modelLabelOf(model)} · {agoOf(lastActivityAt, now)}
      </Text>
      {onArchive !== null && (
        <Pressable
          accessibilityLabel={onArchive.label}
          accessibilityRole="button"
          disabled={onArchive.isBusy}
          hitSlop={6}
          onPress={(event) => {
            event.stopPropagation();
            onArchive.press();
          }}
          style={local.archive}
        >
          {onArchive.isEmpty ? <DeleteIcon color={colors.textMuted} /> : <ArchiveIcon color={colors.textMuted} />}
        </Pressable>
      )}
    </Pressable>
  );
}

/** A quest's tree read at the shared service seam and drawn with the same rows on every overview. */
export function QuestTreeLines({
  client,
  collapsed,
  mission,
  now,
  onOpen,
  onOpenThread,
  onToggle,
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  mission: MissionSummary;
  now: number;
  onOpen: (missionId: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onToggle: (id: string) => void;
  shouldShowAgentThreads: boolean;
}) {
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadThreadTree", missionId: mission.id },
    `${mission.id}:tree`,
  );
  const threads: ReadonlyArray<ThreadSummary> | null = mission.threadCount > 1 ? data : null;
  // An archive from the list leaves the open view alone, as from the sidebar.
  const ending = useEnding(client, mission, false);
  return (
    <>
      {questListRowsOf(mission, threads, collapsed, shouldShowAgentThreads).map((row) => (
        <QuestLine
          depth={row.depth}
          harness={row.thread?.harness ?? mission.harness}
          isOpen={!collapsed.has(row.id)}
          isYourTurn={(row.thread?.isYourTurn ?? mission.isYourTurn) === true}
          key={row.id}
          lastActivityAt={row.thread?.lastActivityAt ?? mission.lastActivityAt}
          model={row.thread?.model ?? mission.model}
          now={now}
          onArchive={
            row.thread === null
              ? {
                  isBusy: ending.isBusy,
                  isEmpty: mission.isEmpty,
                  label: `${mission.isEmpty ? "Delete" : "Archive"} ${mission.title}`,
                  press: () => ending.start("Archived"),
                }
              : null
          }
          onOpen={() =>
            row.thread === null ? onOpen(mission.id) : onOpenThread(mission.id, row.thread.id as ThreadId)
          }
          onToggle={row.hasChildren ? () => onToggle(row.id) : null}
          state={row.thread?.state ?? mission.state}
          title={row.thread?.title ?? mission.title}
        />
      ))}
      {(ending.pending !== null || ending.error !== null) && <EndingConfirmation ending={ending} />}
      {ending.error !== null && <Text style={local.error}>{ending.error}</Text>}
      {error !== null && <Text style={local.error}>{error}</Text>}
    </>
  );
}

const local = StyleSheet.create({
  archive: { alignItems: "center", height: 18, justifyContent: "center", width: 18 },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  error: { color: colors.dangerText },
  fold: { alignItems: "center", height: 20, justifyContent: "center", width: 14 },
  foldMark: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 16, lineHeight: 18 },
  foldMarkOpen: { transform: [{ rotate: "90deg" }] },
  line: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  lineHovered: { backgroundColor: colors.controlHover },
  meta: { color: colors.textMuted, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  title: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
