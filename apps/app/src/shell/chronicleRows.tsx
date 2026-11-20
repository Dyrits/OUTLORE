import type { ChronicleItem } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { agoOf } from "../foundation/formatting";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { type ChronicleUrgency, chroniclePhrases, urgencyOf } from "./chronicleFeed";
import { isHovered } from "./railStyles";

/**
 * What each urgency draws: the phrase's color and, for the two that ask for the owner, the corner mark the sidebar's
 * rows carry for the same state (amber for a request, red for a failure), sized by how pressing it is.
 */
const marks = {
  Failure: { color: colors.dangerText, corner: 44 },
  Request: { color: colors.warningText, corner: 28 },
  Routine: { color: colors.textMuted, corner: 0 },
} as const satisfies Record<ChronicleUrgency, { color: string; corner: number }>;

/** One entry of the Chronicle: its conversation, what happened to it, and when. */
export function ChronicleRow({ item, now, onPress }: { item: ChronicleItem; now: number; onPress: () => void }) {
  const urgency = urgencyOf(item);
  const { color, corner } = marks[urgency];
  const isQuiet = urgency === "Routine";
  const phrase = chroniclePhrases[item.kind];
  const ago = agoOf(item.at, now);
  return (
    <Pressable
      accessibilityLabel={`${item.title}, ${phrase}, ${ago}`}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.row,
        isQuiet ? local.rowQuiet : local.rowCard,
        (state.pressed || isHovered(state)) && local.rowHovered,
      ]}
    >
      <Text numberOfLines={2} style={local.title}>
        {item.title}
      </Text>
      <View style={local.detail}>
        <Text numberOfLines={1} style={[local.phrase, { color }]}>
          {phrase}
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
  detail: { alignItems: "baseline", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  phrase: { flexShrink: 1, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "500" },
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
});
