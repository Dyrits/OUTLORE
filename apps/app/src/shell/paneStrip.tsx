import type { ThreadState } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { stripWidth } from "./paneChain";

// Text runs down the strip, as a book's spine does.
const spine = { writingMode: "vertical-rl" } as object;

/**
 * A folded pane: a slim strip with its state and its title along it, one press from open again. Panes the chain has
 * too many of, or the window is too narrow for, wait here as well.
 */
export function PaneStrip({ onReveal, state, title }: { onReveal: () => void; state: ThreadState; title: string }) {
  return (
    <Pressable
      accessibilityLabel={`Open ${title}`}
      accessibilityRole="button"
      onPress={onReveal}
      style={({ pressed }) => [local.strip, pressed && local.pressed]}
    >
      <Text style={local.unfold}>›</Text>
      <View accessibilityLabel={stateLabels[state]} style={[local.dot, { backgroundColor: stateTones[state].color }]} />
      <Text numberOfLines={1} style={[local.title, spine]}>
        {title}
      </Text>
    </Pressable>
  );
}

/** A small button in a pane's header: fold it, or close it. */
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
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  glyph: { color: colors.textSecondary, fontSize: fontSizes.lg },
  pressed: { backgroundColor: colors.controlActive },
  strip: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    borderLeftWidth: 1,
    gap: 10,
    paddingVertical: 10,
    width: stripWidth,
  },
  title: { color: colors.textSecondary, flexShrink: 1, fontSize: fontSizes.base },
  unfold: { color: colors.accentText, fontSize: fontSizes.lg },
});
