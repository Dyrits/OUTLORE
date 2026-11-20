import type { ThreadState } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Emblem, type EmblemName } from "../foundation/emblems";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { errandIconPath } from "../ui/composerIcons";

/** What a folded pane is: the icon of its notch. */
export type NotchKind = "borderlands" | "errand" | "quest" | "realm";

/** The emblem that stands for each kind of pane. */
const emblems = {
  borderlands: "compass",
  quest: "sword",
  realm: "castle",
} as const satisfies Record<Exclude<NotchKind, "errand">, EmblemName>;

/** One folded pane, as one notch. A pane with no state of its own, such as a channel, shows no dot. */
export type NotchPart = { id: string; kind: NotchKind; onReveal: () => void; state: ThreadState | null; title: string };

/**
 * Folded panes next to an open one: a column of small notches on its left or right edge, one per folded pane, each the
 * icon of what it is (realm, quest or errand) with its state dot, one press from open again. A notch takes no room from
 * the open pane.
 */
export function PaneNotches({ parts, side }: { parts: ReadonlyArray<NotchPart>; side: "left" | "right" }) {
  return (
    <View pointerEvents="box-none" style={[local.notches, side === "left" ? local.atLeft : local.atRight]}>
      {parts.map((part) => (
        <Pressable
          accessibilityLabel={`Open ${part.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          key={part.id}
          onPress={part.onReveal}
          style={({ pressed }) => [
            local.notch,
            side === "left" ? local.notchLeft : local.notchRight,
            pressed && local.pressed,
          ]}
        >
          {part.kind === "errand" ? (
            <ErrandMark />
          ) : (
            <Emblem name={emblems[part.kind]} size={16} tint={colors.textSecondary} />
          )}
          {part.state !== null && (
            <View
              accessibilityLabel={stateLabels[part.state]}
              style={[local.dot, { backgroundColor: stateTones[part.state].color }]}
            />
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** The branch that marks an errand, as in @ mentions. */
function ErrandMark() {
  return (
    <Svg
      fill="none"
      height={16}
      stroke={colors.textSecondary}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 20 20"
      width={16}
    >
      <Path d={errandIconPath} />
    </Svg>
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
  atLeft: { left: 0 },
  atRight: { right: 0 },
  button: { alignItems: "center", borderRadius: radii.sm, height: 26, justifyContent: "center", width: 26 },
  dot: {
    borderColor: colors.sidebar,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    height: 10,
    position: "absolute",
    right: 1,
    top: 1,
    width: 10,
  },
  glyph: { color: colors.textSecondary, fontSize: fontSizes.lg },
  notch: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 26,
  },
  notches: { bottom: 0, gap: 6, justifyContent: "center", position: "absolute", top: 0, zIndex: 2 },
  notchLeft: { borderBottomRightRadius: radii.md, borderLeftWidth: 0, borderTopRightRadius: radii.md },
  notchRight: { borderBottomLeftRadius: radii.md, borderRightWidth: 0, borderTopLeftRadius: radii.md },
  pressed: { backgroundColor: colors.controlActive },
});
