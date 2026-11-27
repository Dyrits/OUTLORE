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

/** The icon for a folded pane or a child navigation control. */
export type NotchKind = "borderlands" | "errand" | "list" | "quest" | "realm" | "ritual";

const emblems = {
  quest: "sword",
  ritual: "moon",
} as const satisfies Record<Exclude<NotchKind, "borderlands" | "errand" | "list" | "realm">, EmblemName>;

/** A folded pane or a control for creating or browsing the children of a pane. */
export type NotchPart = {
  id: string;
  /** The notch starts a new object (an errand of the quest, a quest of the realm): its icon carries a small "+". */
  isNew?: boolean;
  kind: NotchKind;
  /** What a list notch lists: crossed swords for quests, a line with three branches for errands. */
  listOf?: "quest" | "errand";
  onReveal: () => void;
  state: ThreadState | MissionState | null;
  title: string;
};

/** Places the edge controls and shows each title on hover or keyboard focus. */
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
  // In the Islands layout a notch is a bite out of its island seen from the outside: it takes the background of the app
  // as the gap between islands shows it, and the island's hairline runs around it. The flat layout keeps the sidebar's color.
  const islands = useIslandFrame();
  const fill = islands === null ? { backgroundColor: colors.sidebar } : islands.gapOf(isStraddling ? 2 : 1);
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
          accessibilityLabel={part.isNew === true ? part.title : `Open ${part.title}`}
          accessibilityRole="button"
          key={part.id}
          onBlur={() => setShown(null)}
          onFocus={() => setShown(part.id)}
          onHoverIn={() => setShown(part.id)}
          onHoverOut={() => setShown(null)}
          onPress={part.onReveal}
          style={({ pressed }) => [
            local.notch,
            side === "left" ? (isStraddling ? local.notchOnLine : local.notchLeft) : local.notchRight,
            fill,
            // The gap's image covers a background color, so a pressed notch in the Islands layout dims instead.
            pressed && (islands === null ? local.pressed : local.pressedOnIsland),
          ]}
        >
          {part.kind === "list" ? (
            part.listOf === "quest" ? (
              <QuestsMark />
            ) : (
              <ErrandsMark />
            )
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
              // The dot's ring is the notch's own background, drawn as a view around the dot: a border could not hold an image.
              <View
                accessibilityLabel={part.state === null ? "No active status" : stateLabels[part.state]}
                style={[local.dotRing, fill]}
              >
                <View
                  style={[
                    local.dot,
                    { backgroundColor: part.state === null ? colors.textMuted : stateTones[part.state].color },
                  ]}
                />
              </View>
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

/** The quest list: two crossed swords, the quest's sword and a second one passing behind it. */
function QuestsMark() {
  return (
    <Svg
      aria-hidden
      fill="none"
      height={16}
      stroke={colors.textSecondary}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.7}
      viewBox="0 0 24 24"
      width={16}
    >
      <Path d="M7 15L18 4h2v2L9 17M5 13l6 6M7 17l-3 3" />
      <Path d="M10.5 8.5L6 4H4v2l4.5 4.5M19 13l-6 6M17 17l3 3" />
    </Svg>
  );
}

/** The errand list: the errand's line with three branches, and no plus. */
function ErrandsMark() {
  return (
    <Svg
      aria-hidden
      fill="none"
      height={16}
      stroke={colors.textSecondary}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.6}
      viewBox="0 0 20 20"
      width={16}
    >
      <Path d="M6 18V2M6 6c0 0 5 0 8-4M6 11c0 0 6 0 10-4M6 16c0 0 6 0 10-4" />
    </Svg>
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

/** The branch that marks an errand, as in # mentions. */
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
  dot: { borderRadius: radii.pill, flex: 1 },
  dotRing: {
    borderRadius: radii.pill,
    height: 10,
    padding: 1.5,
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
  pressedOnIsland: { opacity: 0.7 },
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
