import type {
  LastExchange,
  MissionId,
  MissionState,
  MissionSummary,
  ThreadId,
  ThreadState,
  ThreadSummary,
} from "@outlore/contracts";
import { createContext, type ReactNode, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { agoOf } from "../foundation/formatting";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { scheduleLabelOf } from "../rituals/ritualLabels";
import { ChipIcon } from "../ui/chips";
import { handCursor, isHovered } from "../ui/pointer";
import { replyCountLabelOf } from "./replyLineLabels";

/** The threads open as panes beside the one drawing, so a reply line can show that its errand is already open. */
export const OpenPanes = createContext<ReadonlySet<ThreadId>>(new Set());

/** A thread title cut for a one-line label. */
const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/** A sample of a message on one line, with its line breaks and runs of spaces collapsed. */
const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** A creation action that sits alongside the cards for existing quests and errands. */
export function NewReplyCard({
  isDisabled = false,
  label,
  onPress,
}: {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={(state) => [
        local.line,
        local.lineNew,
        !isDisabled && isHovered(state) && local.lineActive,
        state.pressed && local.linePressed,
        isDisabled && local.lineDisabled,
      ]}
    >
      <View style={local.row}>
        <Text style={local.title}>+ {label}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The block of a reply line: who opened the work, its title, a sample of its last exchange (the owner's latest message
 * and the companion's latest reply, as a thread summary quotes them in Slack), its state and how long ago it moved, and
 * the press that opens its pane.
 */
function ReplyCard({
  actions,
  isRitual = false,
  isOpen,
  label,
  meta,
  onPress,
  origin,
  sample,
  state,
  title,
}: {
  actions?: ReactNode;
  isOpen: boolean;
  isRitual?: boolean;
  label: string;
  /** What follows the state on the last line: the waiting count and how long ago it last moved. */
  meta: string;
  onPress: () => void;
  origin: string;
  /** The last exchange to quote, or null while the work's quest or errand is not loaded. */
  sample: LastExchange | null;
  /** The state it was opened with, or none when it cannot be known while the quest is not loaded (or archived). */
  state?: ThreadState | MissionState;
  title: string;
}) {
  const tone = state === undefined ? null : stateTones[state];
  const openCard = (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) =>
        actions === undefined ? [local.line, (pressed || isOpen) && local.lineActive] : local.openArea
      }
    >
      <Text style={local.origin}>{origin}</Text>
      <View style={local.row}>
        {isRitual ? (
          <ChipIcon color={colors.highlight} kind="ritual" size={15} />
        ) : (
          tone !== null && <View style={[local.dot, { backgroundColor: tone.color }]} />
        )}
        <Text numberOfLines={1} style={local.title}>
          {shortened(title)}
        </Text>
        <Text style={local.go}>{isOpen ? "Open" : "Open ›"}</Text>
      </View>
      {sample !== null && (sample.owner !== null || sample.reply !== null) && (
        <View style={local.sample}>
          {sample.owner !== null && (
            <Text numberOfLines={1} style={local.sampleLine}>
              <Text style={local.speaker}>You </Text>
              {oneLine(sample.owner)}
            </Text>
          )}
          {sample.reply !== null && (
            <Text numberOfLines={2} style={local.sampleLine}>
              <Text style={local.speaker}>Companion </Text>
              {oneLine(sample.reply)}
            </Text>
          )}
        </View>
      )}
      <Text style={local.meta}>
        {state !== undefined && <Text style={{ color: stateTones[state].color }}>{stateLabels[state]}</Text>}
        {meta}
      </Text>
    </Pressable>
  );
  return actions === undefined ? (
    openCard
  ) : (
    <View style={[local.line, local.actionCard, isOpen && local.lineActive]}>
      {openCard}
      <View style={local.actions}>{actions}</View>
    </View>
  );
}

/**
 * Compact one-line reply bar shown directly under an anchor message in the conversation feed: state dot, reply count,
 * title, waiting/attention indicator, and last activity time.
 */
function CompactReplyBar({
  activityAt,
  isOpen,
  kind,
  label,
  onPress,
  replyCount,
  state,
  title,
  waitingCount = 0,
}: {
  activityAt: number | null;
  isOpen: boolean;
  /** What the line opens, which its small mark shows: a quest or an errand. */
  kind: "errand" | "quest";
  label: string;
  onPress: () => void;
  replyCount: number | undefined;
  state?: ThreadState | MissionState;
  title: string;
  waitingCount?: number;
}) {
  const tone = state === undefined ? null : stateTones[state];
  const countLabel = replyCountLabelOf(replyCount, state);
  const badge = waitingCount > 0 ? `${waitingCount} waiting` : state === "Attention" ? stateLabels.Attention : null;
  return (
    <View style={local.compactRow}>
      {/* The elbow sits beside the pressable area, not under it, so the pressed or hovered fill never covers it. */}
      <View style={local.compactElbow} />
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onPress}
        style={(pressState) => [
          local.compactBar,
          (pressState.pressed || isOpen || isHovered(pressState)) && local.lineActive,
        ]}
      >
        {tone !== null && <View style={[local.dot, { backgroundColor: tone.color }]} />}
        {countLabel !== null && <Text style={local.compactCount}>{countLabel}</Text>}
        <Text numberOfLines={1} style={local.compactTitle}>
          {shortened(title)}
        </Text>
        {badge !== null && <Text style={[local.compactBadge, tone !== null && { color: tone.color }]}>{badge}</Text>}
        {activityAt !== null && activityAt > 0 && (
          <Text style={local.compactMeta}>{agoOf(activityAt, Date.now())}</Text>
        )}
        <ChipIcon color={colors.accentText} kind={kind} size={14} />
      </Pressable>
    </View>
  );
}

/**
 * The reply line under the message an errand hangs from (CHG-0561): who opened it, its title, a sample of its last
 * exchange, its state and how long ago it last moved. Pressing it opens the errand's conversation in the next pane, as a
 * thread opens in Slack; it is marked while that pane is open.
 */
export function ReplyLine({
  actions,
  isCompact = false,
  onOpen,
  thread,
}: {
  actions?: ReactNode;
  isCompact?: boolean;
  onOpen: (threadId: ThreadId) => void;
  thread: ThreadSummary;
}) {
  const isOpen = useContext(OpenPanes).has(thread.id);
  if (isCompact && actions === undefined) {
    return (
      <CompactReplyBar
        activityAt={thread.lastActivityAt}
        isOpen={isOpen}
        kind="errand"
        label={`Errand: ${thread.title}, ${stateLabels[thread.shownState]}`}
        onPress={() => onOpen(thread.id)}
        replyCount={thread.replyCount}
        state={thread.shownState}
        title={thread.title}
        waitingCount={thread.waitingCount}
      />
    );
  }
  return (
    <ReplyCard
      actions={actions}
      isOpen={isOpen}
      label={`Errand: ${thread.title}, ${stateLabels[thread.shownState]}`}
      meta={`${thread.waitingCount > 0 ? ` · ${thread.waitingCount} waiting` : ""} · ${agoOf(thread.lastActivityAt, Date.now())}`}
      onPress={() => onOpen(thread.id)}
      origin={thread.isOpenedByAgent ? "Companion opened an errand" : "Opened an errand"}
      sample={thread.lastExchange}
      state={thread.shownState}
      title={thread.title}
    />
  );
}

/**
 * A quest as a block (conversation panes): what Chronicler or the owner made of it, its state, a sample of its last
 * exchange and how long ago it last moved. Pressing it opens the quest in the next pane; it is marked while that pane is
 * open. The reply line in a realm's conversation and the realm's Quests tab both show quests this way.
 */
export function QuestCard({
  actions,
  label,
  onOpen,
  origin,
  quest,
}: {
  actions?: ReactNode;
  label: string;
  onOpen: () => void;
  origin: string;
  quest: MissionSummary;
}) {
  const isOpen = useContext(OpenPanes).has(quest.topThreadId);
  return (
    <ReplyCard
      actions={actions}
      isOpen={isOpen}
      label={`${label}: ${quest.title}`}
      meta={`${quest.state === "Resting" ? " · your turn" : ""} · ${agoOf(quest.lastActivityAt, Date.now())}`}
      onPress={onOpen}
      origin={origin}
      sample={quest.lastExchange}
      state={quest.state}
      title={quest.title}
    />
  );
}

/**
 * A Ritual as a block, as the realm's Quests tab lists it beside the quests (CHG-0616): the moon's meaning carried by
 * its label, its schedule in place of a quest's last exchange, and its runs openable as errands once pressed.
 */
export function RitualReplyCard({ onOpen, ritual }: { onOpen: () => void; ritual: MissionSummary }) {
  const card = ritual.ritual;
  const isOpen = useContext(OpenPanes).has(ritual.topThreadId);
  if (card === null) return null;
  return (
    <ReplyCard
      isOpen={isOpen}
      isRitual
      label={`Ritual: ${ritual.title}`}
      meta={` · ${[
        scheduleLabelOf(card.schedule),
        card.isOn ? "On" : "Off",
        ...(card.lastRunState === "Underway" ? ["A run is underway"] : []),
      ].join(" · ")}`}
      onPress={onOpen}
      origin="Ritual"
      sample={null}
      state={ritual.state}
      title={ritual.title}
    />
  );
}

/**
 * The reply line of a quest in the Chronicle (CHG-0564): the quest Chronicler opened or continued stands as a card under
 * the message that confirmed it, with the quest's own state and how long ago it last moved, read from the quest list so
 * it stays current. Pressing it opens the quest in the next pane. A quest the list no longer holds (archived, or not yet
 * loaded) keeps the title and the state it was opened with.
 */
export function QuestReplyLine({
  client,
  isCompact = false,
  label,
  missionId,
  onOpen,
  title,
}: {
  client: ServiceClient;
  isCompact?: boolean;
  /** What Chronicler did with the quest: "Opened a quest", "Continued in a quest". */
  label: string;
  missionId: MissionId;
  onOpen: (missionId: MissionId) => void;
  title: string;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const quest = data?.missions.find((mission) => mission.id === missionId) ?? null;
  const openPanes = useContext(OpenPanes);
  if (isCompact) {
    return (
      <CompactReplyBar
        activityAt={quest?.lastActivityAt ?? null}
        isOpen={quest !== null && openPanes.has(quest.topThreadId)}
        kind="quest"
        label={`${label}: ${quest?.title ?? title}`}
        onPress={() => onOpen(missionId)}
        replyCount={quest?.replyCount}
        state={quest?.state}
        title={quest?.title ?? title}
      />
    );
  }
  if (quest !== null) return <QuestCard label={label} onOpen={() => onOpen(missionId)} origin={label} quest={quest} />;
  return (
    <ReplyCard
      isOpen={false}
      label={`${label}: ${title}`}
      meta=""
      onPress={() => onOpen(missionId)}
      origin={label}
      sample={null}
      title={title}
    />
  );
}

const local = StyleSheet.create({
  actionCard: { alignItems: "flex-start", flexDirection: "row", gap: 12 },
  actions: { alignItems: "center", flexDirection: "row", gap: 12 },
  compactBadge: { fontSize: fontSizes.xs, fontWeight: "600" },
  // The line has no box: plain text hung from the message above by an elbow, as Slack hangs a thread from its message.
  compactBar: {
    alignItems: "center",
    borderRadius: radii.md,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    ...handCursor,
  },
  compactCount: { color: colors.accentText, fontSize: fontSizes.sm, fontWeight: "600" },
  compactElbow: {
    borderBottomColor: colors.edge,
    borderBottomLeftRadius: radii.md,
    borderBottomWidth: 2,
    borderLeftColor: colors.edge,
    borderLeftWidth: 2,
    height: 18,
    marginTop: -8,
    width: 10,
  },
  compactMeta: { color: colors.textMuted, fontSize: fontSizes.xs },
  compactRow: { alignItems: "center", alignSelf: "stretch", flexDirection: "row" },
  compactTitle: { color: colors.text, flex: 1, fontSize: fontSizes.sm, fontWeight: "500" },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  go: { color: colors.accentText, fontSize: fontSizes.sm },
  line: {
    alignSelf: "stretch",
    borderColor: colors.edge,
    borderLeftWidth: 3,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
    marginLeft: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lineActive: { backgroundColor: colors.accentSoft, borderLeftColor: colors.accentText },
  lineDisabled: { opacity: 0.5 },
  lineNew: { borderLeftWidth: 1, borderStyle: "dashed", justifyContent: "center", minHeight: 40, ...handCursor },
  linePressed: { opacity: 0.8 },
  meta: { color: colors.textMuted, fontSize: fontSizes.sm },
  openArea: { flex: 1, gap: 4, minWidth: 0 },
  origin: { color: colors.textMuted, fontSize: fontSizes.sm },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  // The sample is quoted the way Slack quotes a thread's last reply: a rule at its left, the speakers in bold.
  sample: { borderLeftColor: colors.edge, borderLeftWidth: 2, gap: 2, paddingLeft: 8 },
  sampleLine: { color: colors.textSecondary, fontSize: fontSizes.sm },
  speaker: { color: colors.text, fontWeight: "600" },
  title: { color: colors.text, flex: 1, fontSize: fontSizes.base, fontWeight: "600" },
});
