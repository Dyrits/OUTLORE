import type { MissionId, MissionSummary, ThreadId, ThreadSummary, WorkspaceChoice } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { Emblem } from "../foundation/emblems";
import { harnessLabels, modelLabelOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii, stateLabels, stateTones } from "../foundation/theme";
import { useEnding } from "../foundation/useEnding";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { EndingConfirmation } from "../quests/missionActions";
import { DeleteRitualButton, realmArchivedNotice } from "../rituals/ritualCard";
import { nextRunLabelOf, scheduleLabelOf } from "../rituals/ritualLabels";
import { isRealmArchivedOf } from "../rituals/ritualRow";
import { agoOf } from "./questRecency";
import { questListRowsOf } from "./questTree";
import { ArchiveIcon, DeleteIcon } from "./railActions";

/** The shared compact quest and errand row, indented beneath its parent. */
function QuestLine({
  depth,
  harness,
  isArchived = false,
  isOpen,
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
  /** Whether the quest is archived, which the line says in place of an archive button. */
  isArchived?: boolean;
  isOpen: boolean;
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
      <View accessibilityLabel={stateLabels[state]} style={[local.dot, { backgroundColor: tone.color }]} />
      <Text numberOfLines={1} style={local.title}>
        {title}
      </Text>
      <Text numberOfLines={1} style={local.meta}>
        {isArchived && "Archived · "}
        {harnessLabels[harness]} · {modelLabelOf(model)} · {agoOf(lastActivityAt, now)}
      </Text>
      {onArchive !== null && !isArchived && (
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

/**
 * A Ritual's line on a list of a realm's things (CHG-0616): the moon and its schedule, a dot while a run is
 * underway, dimmed while off, and its runs beneath it as errands. Its only mark is Delete, whose one confirmation
 * names what is lost; a Ritual archives nothing.
 */
function RitualLine({
  client,
  collapsed,
  isRealmArchived,
  mission,
  now,
  onOpen,
  onOpenThread,
  onToggle,
  shouldShowAgentThreads,
  threads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  isRealmArchived: boolean;
  mission: MissionSummary;
  now: number;
  onOpen: (missionId: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onToggle: (id: string) => void;
  shouldShowAgentThreads: boolean;
  /** The Ritual's read tree, null until it loads; the runs show beneath the Ritual once it has. */
  threads: ReadonlyArray<ThreadSummary> | null;
}) {
  const ritual = mission.ritual;
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  if (ritual === null) return null;
  return (
    <>
      <Pressable
        accessibilityLabel={mission.title}
        accessibilityRole="button"
        onPress={() => onOpen(mission.id)}
        style={(pressed: { pressed: boolean; hovered?: boolean }) => [
          local.line,
          { paddingLeft: 4 },
          (pressed.pressed || pressed.hovered) && local.lineHovered,
        ]}
      >
        <View style={local.ritualMoon}>
          <Emblem name="moon" size={14} tint={colors.highlight} />
        </View>
        <View style={styles.flex}>
          <View style={local.ritualTitleRow}>
            <Text numberOfLines={1} style={local.ritualTitle}>
              {mission.title}
            </Text>
            {ritual.lastRunState === "Underway" && <View style={local.ritualUnderway} />}
          </View>
          <Text numberOfLines={1} style={[local.meta, !ritual.isOn && local.ritualOff]}>
            {scheduleLabelOf(ritual.schedule)} · {nextRunLabelOf(ritual.isOn ? ritual.nextRunAt : null, now)} ·{" "}
            {agoOf(mission.lastActivityAt, now)}
          </Text>
        </View>
        <Pressable
          accessibilityLabel={`Delete ${mission.title}`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={(event) => {
            event.stopPropagation();
            setIsDeleting(true);
          }}
          style={local.archive}
        >
          <DeleteIcon color={colors.textMuted} />
        </Pressable>
      </Pressable>
      {isDeleting && (
        <View style={{ paddingLeft: 22 }}>
          <DeleteRitualButton client={client} onError={setError} ritualId={ritual.id} title={mission.title} />
        </View>
      )}
      {isRealmArchived && <Text style={[local.meta, { paddingLeft: 22 }]}>{realmArchivedNotice}</Text>}
      {questListRowsOf(mission, threads, collapsed, shouldShowAgentThreads)
        // The Ritual's own row is drawn above; only its runs' errand rows follow beneath it.
        .flatMap(({ depth, hasChildren, id, thread }) =>
          thread === null
            ? []
            : [
                <QuestLine
                  depth={depth}
                  harness={thread.harness}
                  isOpen={!collapsed.has(id)}
                  key={id}
                  lastActivityAt={thread.lastActivityAt}
                  model={thread.model}
                  now={now}
                  onArchive={null}
                  onOpen={() => onOpenThread(mission.id, thread.id)}
                  onToggle={hasChildren ? () => onToggle(id) : null}
                  state={thread.state}
                  title={thread.title}
                />,
              ],
        )}
      {error !== null && <Text style={local.error}>{error}</Text>}
    </>
  );
}

/** A quest's tree read at the shared service seam and drawn with the same rows in the History tab. */
export function QuestTreeLines({
  client,
  collapsed,
  isArchived = false,
  mission,
  now,
  onOpen,
  onOpenThread,
  onToggle,
  realms = [],
  shouldShowAgentThreads,
}: {
  client: ServiceClient;
  collapsed: ReadonlySet<string>;
  /** Whether the quest is archived: its lines say so and offer no archive button. */
  isArchived?: boolean;
  mission: MissionSummary;
  now: number;
  onOpen: (missionId: MissionId) => void;
  onOpenThread: (missionId: MissionId, threadId: ThreadId) => void;
  onToggle: (id: string) => void;
  /** The active realms, from which a missing one means a Ritual's realm is archived. */
  realms?: ReadonlyArray<WorkspaceChoice>;
  shouldShowAgentThreads: boolean;
}) {
  const ritual = mission.ritual;
  const { data, error } = useServiceQuery(
    client,
    { _tag: "ReadThreadTree", missionId: mission.id },
    `${mission.id}:tree`,
  );
  // An archive from the list leaves the open view alone, as from the sidebar.
  const ending = useEnding(client, mission, false);
  if (ritual !== null)
    return (
      <RitualLine
        client={client}
        collapsed={collapsed}
        isRealmArchived={isRealmArchivedOf(mission, realms)}
        mission={mission}
        now={now}
        onOpen={onOpen}
        onOpenThread={onOpenThread}
        onToggle={onToggle}
        shouldShowAgentThreads={shouldShowAgentThreads}
        threads={mission.threadCount > 1 ? data : null}
      />
    );
  const threads: ReadonlyArray<ThreadSummary> | null = mission.threadCount > 1 ? data : null;
  return (
    <>
      {questListRowsOf(mission, threads, collapsed, shouldShowAgentThreads).map((row) => (
        <QuestLine
          depth={row.depth}
          harness={row.thread?.harness ?? mission.harness}
          isArchived={isArchived}
          isOpen={!collapsed.has(row.id)}
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
          onOpen={() => (row.thread === null ? onOpen(mission.id) : onOpenThread(mission.id, row.thread.id))}
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
  // A Ritual's line: the moon in the quest's state-dot place, its dot while a run is underway, dimmed while off.
  ritualMoon: { alignItems: "center", height: 20, justifyContent: "center", width: 20 },
  ritualOff: { opacity: 0.75 },
  ritualTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  ritualTitleRow: { alignItems: "center", flexDirection: "row", gap: 6 },
  ritualUnderway: { backgroundColor: colors.underwayText, borderRadius: radii.pill, height: 6, width: 6 },
  title: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
});
