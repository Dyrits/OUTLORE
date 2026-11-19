import type { ThreadId, ThreadSummary } from "@outlore/contracts";
import { createContext, useContext } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { agoOf } from "../foundation/formatting";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";

/** The threads open as panes beside the one drawing, so a reply line can show that its errand is already open. */
export const OpenPanes = createContext<ReadonlySet<ThreadId>>(new Set());

/** A thread title cut for a one-line label. */
const shortened = (title: string) => (title.length > 60 ? `${title.slice(0, 59)}…` : title);

/**
 * The reply line under the message an errand hangs from (CHG-0558): who opened it, its title, its state and how long
 * ago it last moved. Pressing it opens the errand's conversation in the next pane, as a thread opens in Slack; it is
 * marked while that pane is open.
 */
export function ReplyLine({ onOpen, thread }: { onOpen: (threadId: ThreadId) => void; thread: ThreadSummary }) {
  const isOpen = useContext(OpenPanes).has(thread.id);
  const tone = stateTones[thread.state];
  return (
    <Pressable
      accessibilityLabel={`Errand: ${thread.title}, ${stateLabels[thread.state]}`}
      accessibilityRole="button"
      onPress={() => onOpen(thread.id)}
      style={({ pressed }) => [local.line, (pressed || isOpen) && local.lineActive]}
    >
      <Text style={local.origin}>{thread.isOpenedByAgent ? "Companion opened an errand" : "Opened an errand"}</Text>
      <View style={local.row}>
        <View style={[local.dot, { backgroundColor: tone.color }]} />
        <Text numberOfLines={1} style={local.title}>
          {shortened(thread.title)}
        </Text>
        <Text style={local.go}>{isOpen ? "Open" : "Open ›"}</Text>
      </View>
      <Text style={local.meta}>
        <Text style={{ color: tone.color }}>{stateLabels[thread.state]}</Text>
        {thread.waitingCount > 0 && ` · ${thread.waitingCount} waiting`} · {agoOf(thread.lastActivityAt, Date.now())}
      </Text>
    </Pressable>
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
