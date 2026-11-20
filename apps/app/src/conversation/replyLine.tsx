import type {
  LastExchange,
  MissionId,
  MissionState,
  MissionSummary,
  ThreadId,
  ThreadState,
  ThreadSummary,
} from "@outlore/contracts";
import { createContext, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { agoOf } from "../foundation/formatting";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { handCursor, isHovered } from "../ui/pointer";

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
  isOpen,
  label,
  meta,
  onPress,
  origin,
  sample,
  state,
  title,
}: {
  isOpen: boolean;
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
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.line, (pressed || isOpen) && local.lineActive]}
    >
      <Text style={local.origin}>{origin}</Text>
      <View style={local.row}>
        {tone !== null && <View style={[local.dot, { backgroundColor: tone.color }]} />}
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
}

/**
 * The reply line under the message an errand hangs from (CHG-0561): who opened it, its title, a sample of its last
 * exchange, its state and how long ago it last moved. Pressing it opens the errand's conversation in the next pane, as a
 * thread opens in Slack; it is marked while that pane is open.
 */
export function ReplyLine({ onOpen, thread }: { onOpen: (threadId: ThreadId) => void; thread: ThreadSummary }) {
  const isOpen = useContext(OpenPanes).has(thread.id);
  return (
    <ReplyCard
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
  label,
  onOpen,
  origin,
  quest,
}: {
  label: string;
  onOpen: () => void;
  origin: string;
  quest: MissionSummary;
}) {
  const isOpen = useContext(OpenPanes).has(quest.topThreadId);
  return (
    <ReplyCard
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
 * The reply line of a quest in the Chronicle (CHG-0564): the quest Chronicler opened or continued stands as a card under
 * the message that confirmed it, with the quest's own state and how long ago it last moved, read from the quest list so
 * it stays current. Pressing it opens the quest in the next pane. A quest the list no longer holds (archived, or not yet
 * loaded) keeps the title and the state it was opened with.
 */
export function QuestReplyLine({
  client,
  label,
  missionId,
  onOpen,
  title,
}: {
  client: ServiceClient;
  /** What Chronicler did with the quest: "Opened a quest", "Continued in a quest". */
  label: string;
  missionId: MissionId;
  onOpen: (missionId: MissionId) => void;
  title: string;
}) {
  const { data } = useServiceQuery(client, allMissions.request, allMissions.key);
  const quest = data?.missions.find((mission) => mission.id === missionId) ?? null;
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
  origin: { color: colors.textMuted, fontSize: fontSizes.sm },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  // The sample is quoted the way Slack quotes a thread's last reply: a rule at its left, the speakers in bold.
  sample: { borderLeftColor: colors.edge, borderLeftWidth: 2, gap: 2, paddingLeft: 8 },
  sampleLine: { color: colors.textSecondary, fontSize: fontSizes.sm },
  speaker: { color: colors.text, fontWeight: "600" },
  title: { color: colors.text, flex: 1, fontSize: fontSizes.base, fontWeight: "600" },
});
