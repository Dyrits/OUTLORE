import type { MissionId, MissionState, ThreadId, ThreadState, ThreadSummary } from "@outlore/contracts";
import { createContext, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { agoOf } from "../foundation/formatting";
import { allMissions } from "../foundation/queries";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";

/** The threads open as panes beside the one drawing, so a reply line can show that its errand is already open. */
export const OpenPanes = createContext<ReadonlySet<ThreadId>>(new Set());

/** A thread title cut for a one-line label. */
const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/** The card of a reply line: who opened the work, its title, its state and what is new, and the press that opens its pane. */
function ReplyCard({
  isOpen,
  label,
  meta,
  onPress,
  origin,
  state,
  title,
}: {
  isOpen: boolean;
  label: string;
  /** What follows the state on the last line: the waiting count and how long ago it last moved. */
  meta: string;
  onPress: () => void;
  origin: string;
  state: ThreadState | MissionState;
  title: string;
}) {
  const tone = stateTones[state];
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.line, (pressed || isOpen) && local.lineActive]}
    >
      <Text style={local.origin}>{origin}</Text>
      <View style={local.row}>
        <View style={[local.dot, { backgroundColor: tone.color }]} />
        <Text numberOfLines={1} style={local.title}>
          {shortened(title)}
        </Text>
        <Text style={local.go}>{isOpen ? "Open" : "Open ›"}</Text>
      </View>
      <Text style={local.meta}>
        <Text style={{ color: tone.color }}>{stateLabels[state]}</Text>
        {meta}
      </Text>
    </Pressable>
  );
}

/**
 * The reply line under the message an errand hangs from (CHG-0561): who opened it, its title, its state and how long
 * ago it last moved. Pressing it opens the errand's conversation in the next pane, as a thread opens in Slack; it is
 * marked while that pane is open.
 */
export function ReplyLine({ onOpen, thread }: { onOpen: (threadId: ThreadId) => void; thread: ThreadSummary }) {
  const isOpen = useContext(OpenPanes).has(thread.id);
  return (
    <ReplyCard
      isOpen={isOpen}
      label={`Errand: ${thread.title}, ${stateLabels[thread.state]}`}
      meta={`${thread.waitingCount > 0 ? ` · ${thread.waitingCount} waiting` : ""} · ${agoOf(thread.lastActivityAt, Date.now())}`}
      onPress={() => onOpen(thread.id)}
      origin={thread.isOpenedByAgent ? "Companion opened an errand" : "Opened an errand"}
      state={thread.state}
      title={thread.title}
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
  const isOpen = useContext(OpenPanes).has(quest?.topThreadId ?? ("" as ThreadId));
  const state = quest?.state ?? "Idle";
  return (
    <ReplyCard
      isOpen={isOpen}
      label={`${label}: ${quest?.title ?? title}`}
      meta={
        quest === null
          ? ""
          : `${quest.isYourTurn === true ? " · your turn" : ""} · ${agoOf(quest.lastActivityAt, Date.now())}`
      }
      onPress={() => onOpen(missionId)}
      origin={label}
      state={state}
      title={quest?.title ?? title}
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
    gap: 3,
    marginLeft: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  lineActive: { backgroundColor: colors.accentSoft, borderLeftColor: colors.accentText },
  meta: { color: colors.textMuted, fontSize: fontSizes.sm },
  origin: { color: colors.textMuted, fontSize: fontSizes.sm },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  title: { color: colors.text, flex: 1, fontSize: fontSizes.base, fontWeight: "600" },
});
