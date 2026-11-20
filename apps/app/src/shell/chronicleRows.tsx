import type { ChronicleItem } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { agoOf } from "../foundation/formatting";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { type ChronicleUrgency, chroniclePhrases, urgencyOf } from "./chronicleFeed";
import { isHovered } from "./railStyles";

/**
 * What each urgency draws: the phrase's color and, for the three that ask for the owner, the corner mark the sidebar's
 * rows carry for the same state (red for a failure, amber for a request, blue for unread replies), sized by how
 * pressing it is.
 */
const marks = {
  Failure: { color: colors.dangerText, corner: 44 },
  Request: { color: colors.warningText, corner: 28 },
  Routine: { color: colors.textMuted, corner: 0 },
  Unread: { color: colors.accentText, corner: 28 },
} as const satisfies Record<ChronicleUrgency, { color: string; corner: number }>;

/**
 * One entry of the Chronicle: what happened to a conversation, and when. Entries of one conversation sit under its
 * heading, where the entry says what happened instead of naming it again.
 */
export function ChronicleRow({
  item,
  isTitled = true,
  now,
  onPress,
}: {
  item: ChronicleItem;
  /** Whether to name the conversation, or leave that to the heading the group of entries stands under. */
  isTitled?: boolean;
  now: number;
  onPress: () => void;
}) {
  const urgency = urgencyOf(item);
  const { color, corner } = marks[urgency];
  const isQuiet = urgency === "Routine";
  const phrase = chroniclePhrases[item.kind];
  const ago = agoOf(item.at, now);
  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${phrase}${item.count > 1 ? `, ${item.count} updates` : ""}, ${ago}`}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.row,
        isQuiet ? local.rowQuiet : local.rowCard,
        (state.pressed || isHovered(state)) && local.rowHovered,
      ]}
    >
      {isTitled && (
        <Text numberOfLines={2} style={local.title}>
          {item.title}
        </Text>
      )}
      <View style={local.detail}>
        {item.isUnread && <View style={local.unreadDot} />}
        <Text numberOfLines={1} style={[local.phrase, { color }]}>
          {item.count > 1 ? `${phrase} (${item.count})` : phrase}
        </Text>
        <Text style={local.ago}>{ago}</Text>
      </View>
      {corner > 0 && (
        <View pointerEvents="none" style={[local.corner, { borderColor: color, height: corner, width: corner }]} />
      )}
    </Pressable>
  );
}

const local = StyleSheet.create({
  ago: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  // The sidebar's corner mark, at card scale: a bottom and left line rounded at the corner, drawn over the card's border.
  corner: {
    borderBottomLeftRadius: radii.lg,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    bottom: -1,
    left: -1,
    position: "absolute",
  },
  detail: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between" },
  phrase: { color: colors.text, flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
  row: { borderRadius: radii.lg, gap: 4 },
  // A request or a failure is a card: it asks for something, so it has an edge.
  rowCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowHovered: { backgroundColor: colors.controlHover },
  // A routine event is a line of the record: no edge, the same left margin as a card's text.
  rowQuiet: { paddingHorizontal: 16, paddingVertical: 8 },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600", lineHeight: 20 },
  unreadDot: {
    backgroundColor: colors.accentText,
    borderRadius: 3,
    height: 6,
    width: 6,
  },
});
