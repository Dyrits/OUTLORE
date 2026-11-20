import type { MissionState, ThreadState } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Emblem, type EmblemName } from "../foundation/emblems";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { errandIconPath } from "../ui/composerIcons";

/** What a notch stands for: its icon. "more" has none: it counts the children left without a notch of their own. */
export type NotchKind = "borderlands" | "errand" | "more" | "quest" | "realm";

/** The emblem that stands for each kind of pane. */
const emblems = {
  borderlands: "compass",
  quest: "sword",
  realm: "castle",
} as const satisfies Record<Exclude<NotchKind, "errand" | "more">, EmblemName>;

/** The width of a notch: the room an open pane leaves on the edge that carries one, so the icon covers no text. */
export const notchWidth = 26;

/**
 * One notch: a folded pane, or a child of the pane (an errand of a quest, a quest of a realm) that has no pane. A pane
 * with no state of its own, such as a channel, shows no dot. A "more" notch carries its `count` and its `title` is the
 * whole label.
 */
export type NotchPart = {
  count?: number;
  id: string;
  kind: NotchKind;
  onReveal: () => void;
  state: ThreadState | MissionState | null;
  title: string;
};

/**
 * Folded panes next to an open one, and the children of a quest or realm pane that have no pane: a column of small
 * notches on its left or right edge, each the icon of what it is (realm, quest or errand) with its state dot, one press
 * from open. A notch takes no room from the open pane.
 */
export function PaneNotches({
  isStraddling = false,
  parts,
  side,
}: {
  /** On the left edge of a pane that has an open pane before it: the notch sits across the line between the two. */
  isStraddling?: boolean;
  parts: ReadonlyArray<NotchPart>;
  side: "left" | "right";
}) {
  return (
    <View
      pointerEvents="box-none"
      style={[local.notches, side === "left" ? (isStraddling ? local.onLine : local.atLeft) : local.atRight]}
    >
      {parts.map((part) => (
        <Pressable
          accessibilityLabel={part.kind === "more" ? part.title : `Open ${part.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          key={part.id}
          onPress={part.onReveal}
          style={({ pressed }) => [
            local.notch,
            side === "left" ? (isStraddling ? local.notchOnLine : local.notchLeft) : local.notchRight,
            pressed && local.pressed,
          ]}
        >
          {part.kind === "more" ? (
            <Text style={local.count}>+{part.count}</Text>
          ) : part.kind === "errand" ? (
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
  count: { color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: "600" },
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
    width: notchWidth,
  },
  notches: { bottom: 0, gap: 6, justifyContent: "center", position: "absolute", top: 0, zIndex: 2 },
  notchLeft: { borderBottomRightRadius: radii.md, borderLeftWidth: 0, borderTopRightRadius: radii.md },
  notchOnLine: { borderRadius: radii.md },
  notchRight: { borderBottomLeftRadius: radii.md, borderRightWidth: 0, borderTopLeftRadius: radii.md },
  onLine: { left: -notchWidth / 2 },
  pressed: { backgroundColor: colors.controlActive },
});
