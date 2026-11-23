import type { MissionState, ThreadState } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Emblem, type EmblemName } from "../foundation/emblems";
import { useIslandFrame } from "../foundation/islands";
import { colors, fontSizes, radii, stateLabels, stateTones } from "../foundation/theme";
import { ChipIcon } from "../ui/chips";
import { errandIconPath } from "../ui/composerIcons";
import { notchWidth } from "./paneNotches";
import { NewQuestIcon } from "./railActions";

/** What a notch stands for: its icon. "more" has none: it counts the children left without a notch of their own. */
export type NotchKind = "borderlands" | "errand" | "more" | "quest" | "realm" | "ritual";

/** The emblem that stands for each kind of pane. */
const emblems = {
  quest: "sword",
  ritual: "moon",
} as const satisfies Record<Exclude<NotchKind, "borderlands" | "errand" | "more" | "realm">, EmblemName>;

/**
 * One notch: a folded pane, or a child of the pane (an errand of a quest, a quest of a realm) that has no pane. A pane
 * with no state of its own, such as a channel, shows no dot. A "more" notch carries its `count` and its `title` is the
 * whole label.
 */
export type NotchPart = {
  count?: number;
  id: string;
  /** The notch starts a new object (an errand of the quest, a quest of the realm): its icon carries a small "+". */
  isNew?: boolean;
  kind: NotchKind;
  onReveal: () => void;
  state: ThreadState | MissionState | null;
  title: string;
};

/**
 * Folded panes next to an open one, and the children of a quest or realm pane that have no pane: a column of small
 * notches on its left or right edge, each the icon of what it is (realm, quest or errand) with its state dot, one press
 * from open. A notch takes no room from the open pane; its title shows beside it on hover or keyboard focus, since
 * several notches can share one icon.
 */
export function PaneNotches({
  gap = 0,
  isStraddling = false,
  parts,
  side,
}: {
  /** The space between open panes in the Islands layout: the notches stand off the slot's far edge by it. */
  gap?: number;
  /** On the left edge of a pane that has an open pane before it: the notch sits across the line between the two. */
  isStraddling?: boolean;
  parts: ReadonlyArray<NotchPart>;
  side: "left" | "right";
}) {
  // Several notches share one icon, so each says its name while the pointer or keyboard focus rests on it.
  const [shown, setShown] = useState<string | null>(null);
  // In the Islands layout a notch is a bite out of its island seen from the outside: it takes the canvas's color, the color
  // of the app's own background, and the island's hairline runs around it. The flat layout keeps the sidebar's color.
  const islands = useIslandFrame();
  const fill = islands === null ? colors.sidebar : islands.canvas;
  return (
    <View
      pointerEvents="box-none"
      style={[
        local.notches,
        side === "left"
          ? isStraddling
            ? { left: -(notchWidth + gap) / 2 }
            : local.atLeft
          : gap === 0
            ? local.atRight
            : { right: gap },
      ]}
    >
      {parts.map((part) => (
        <Pressable
          accessibilityLabel={part.kind === "more" ? part.title : `Open ${part.title}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: false }}
          key={part.id}
          onBlur={() => setShown(null)}
          onFocus={() => setShown(part.id)}
          onHoverIn={() => setShown(part.id)}
          onHoverOut={() => setShown(null)}
          onPress={part.onReveal}
          style={({ pressed }) => [
            local.notch,
            side === "left" ? (isStraddling ? local.notchOnLine : local.notchLeft) : local.notchRight,
            { backgroundColor: fill },
            pressed && local.pressed,
          ]}
        >
          {part.kind === "more" ? (
            <Text style={local.count}>+{part.count}</Text>
          ) : part.isNew === true && part.kind === "quest" ? (
            <NewQuestIcon color={colors.textMuted} />
          ) : part.kind === "realm" || part.kind === "borderlands" ? (
            <ChipIcon color={colors.textSecondary} kind={part.kind} size={16} />
          ) : part.kind === "errand" ? (
            <ErrandMark />
          ) : (
            <Emblem name={emblems[part.kind]} size={16} tint={colors.textSecondary} />
          )}
          {part.isNew === true && part.kind !== "quest" && <PlusMark />}
          {part.isNew !== true &&
            (part.state !== null || part.kind === "realm" || part.kind === "borderlands" || part.kind === "errand") && (
              <View
                accessibilityLabel={part.state === null ? "No active status" : stateLabels[part.state]}
                style={[
                  local.dot,
                  { borderColor: fill },
                  { backgroundColor: part.state === null ? colors.textMuted : stateTones[part.state].color },
                ]}
              />
            )}
          {part.id === shown && part.title !== "" && (
            <View
              pointerEvents="none"
              style={[local.titleEdge, side === "left" ? local.titleAtLeft : local.titleAtRight]}
            >
              <View style={local.titleCard}>
                <Text numberOfLines={2} style={local.titleText}>
                  {part.title}
                </Text>
              </View>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** The small "+" on the corner of a notch that starts something new. */
function PlusMark() {
  return (
    <Svg
      fill="none"
      height={9}
      stroke={colors.textSecondary}
      strokeLinecap="round"
      strokeWidth={1.8}
      style={local.plus}
      viewBox="0 0 10 10"
      width={9}
    >
      <Path d="M5 1v8M1 5h8" />
    </Svg>
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
  plus: { bottom: 3, position: "absolute", right: 3 },
  pressed: { backgroundColor: colors.controlActive },
  titleAtLeft: { left: "100%", marginLeft: 6 },
  titleAtRight: { marginRight: 6, right: "100%" },
  titleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    elevation: 4,
    maxWidth: 240,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: colors.shadow,
    shadowOffset: { height: 3, width: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  titleEdge: { bottom: 0, justifyContent: "center", position: "absolute", top: 0, zIndex: 3 },
  titleText: { color: colors.text, fontSize: fontSizes.sm },
});
