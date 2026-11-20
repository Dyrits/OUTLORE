import type { ThreadState } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { stripWidth } from "./paneChain";

// Text runs down the strip, as a book's spine does.
const spine = { writingMode: "vertical-rl" } as object;

/** One folded pane, as one part of a strip. */
export type StripPart = { id: string; onReveal: () => void; state: ThreadState; title: string };

/**
 * Folded panes next to each other: one slim strip, split in as many equal parts, each with its state and its title along
 * it and one press from open again. Panes the chain has too many of, or the window is too narrow for, wait here as well.
 */
export function PaneStrip({ hasDivider, parts }: { hasDivider: boolean; parts: ReadonlyArray<StripPart> }) {
  return (
    <View style={[local.strip, hasDivider && local.stripDivider]}>
      {parts.map((part, index) => (
        <Pressable
          accessibilityLabel={`Open ${part.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          key={part.id}
          onPress={part.onReveal}
          style={({ pressed }) => [local.part, index > 0 && local.divided, pressed && local.pressed]}
        >
          <Text style={local.unfold}>›</Text>
          <View
            accessibilityLabel={stateLabels[part.state]}
            style={[local.dot, { backgroundColor: stateTones[part.state].color }]}
          />
          <Text numberOfLines={1} style={[local.title, spine]}>
            {part.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A small text button in a pane’s header. */
export function PaneButton({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.button, pressed && local.pressed]}
    >
      <Text style={local.glyph}>{glyph}</Text>
    </Pressable>
  );
}

const local = StyleSheet.create({
  button: { alignItems: "center", borderRadius: radii.sm, height: 26, justifyContent: "center", width: 26 },
  divided: { borderColor: colors.edge, borderTopWidth: 1 },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  glyph: { color: colors.textSecondary, fontSize: fontSizes.lg },
  part: { alignItems: "center", flex: 1, gap: 10, minHeight: 0, paddingVertical: 10 },
  pressed: { backgroundColor: colors.controlActive },
  strip: { backgroundColor: colors.sidebar, width: stripWidth },
  stripDivider: { borderColor: colors.edge, borderLeftWidth: 1 },
  title: { color: colors.textSecondary, flexShrink: 1, fontSize: fontSizes.base },
  unfold: { color: colors.accentText, fontSize: fontSizes.lg },
});
