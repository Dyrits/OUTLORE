import type { ReactNode } from "react";
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { emblemPaths } from "../foundation/emblems";
import { colors, radii } from "../foundation/theme";
import { errandIconPath } from "./composerIcons";

// The icons at the right of a quest's header, after its title: Archive, Mark as done, a separator, the quest's panel.

function HeaderIcon({ children, color }: { children: ReactNode; color: string }) {
  return (
    <Svg
      fill="none"
      height={20}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={20}
    >
      {children}
    </Svg>
  );
}

/**
 * Marks the quest done, or takes the mark back: a checkbox, empty while the quest is open and ticked once it is done,
 * where it reads "Mark as not done".
 */
export function DoneButton({
  isDisabled = false,
  isDone,
  label = isDone ? "Mark as not done" : "Mark as done",
  onPress,
  style,
}: {
  isDisabled?: boolean;
  isDone: boolean;
  label?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const color = isDone ? colors.accentText : colors.textSecondary;
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ checked: isDone, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={style}
    >
      <HeaderIcon color={color}>
        <Rect height={16} rx={3} width={16} x={4} y={4} />
        {isDone && <Path d="M8.5 12.5l2.5 2.5 4.5-5.5" />}
      </HeaderIcon>
    </Pressable>
  );
}

/** Starts a new errand: the errand's branch with a small plus, as the notch that starts one. */
export function NewErrandButton({
  label = "New errand",
  onPress,
  style,
}: {
  label?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.panel, pressed && local.panelActive, style]}
    >
      <Svg
        fill="none"
        height={20}
        stroke={colors.textSecondary}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        viewBox="0 0 20 20"
        width={20}
      >
        <Path d={errandIconPath} />
        <Path d="M15.5 13v5M13 15.5h5" />
      </Svg>
    </Pressable>
  );
}

/** Starts a new quest in the current realm. */
export function NewQuestButton({ onPress, style }: { onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityLabel="New quest"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.panel, pressed && local.panelActive, style]}
    >
      <HeaderIcon color={colors.textSecondary}>
        {emblemPaths.sword.map((path) => (
          <Path d={path} key={path} />
        ))}
        <Path d="M6 2.5v6M3 5.5h6" />
      </HeaderIcon>
    </Pressable>
  );
}

/** A thin vertical line between groups of actions in the pane header. */
export function HeaderSeparator() {
  return <View style={local.separator} />;
}

/**
 * Shows or hides the quest's panel in the right-hand column: the quest's sword, without the plus that starts a quest. It
 * keeps a fill while the column shows the quest's tab.
 */
export function QuestPanelButton({
  isOpen,
  onPress,
  style,
}: {
  isOpen: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityLabel={isOpen ? "Hide quest panel" : "Show quest panel"}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      onPress={onPress}
      style={({ pressed }) => [local.panel, (pressed || isOpen) && local.panelActive, style]}
    >
      <HeaderIcon color={isOpen ? colors.accentText : colors.textSecondary}>
        {emblemPaths.sword.map((path) => (
          <Path d={path} key={path} />
        ))}
      </HeaderIcon>
    </Pressable>
  );
}

/** Gives the pane the available width, shown as two outward arrows. */
export function ExpandPaneButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Expand pane"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [local.panel, pressed && local.panelActive]}
    >
      <HeaderIcon color={colors.textSecondary}>
        <Path d="M14 10l5-5m-6 0h6v6M10 14l-5 5m0-6v6h6" />
      </HeaderIcon>
    </Pressable>
  );
}

/** Folds a pane toward its strip, shown as a bar and inward chevrons. */
export function FoldPaneButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ expanded: true }}
      onPress={onPress}
      style={({ pressed }) => [local.panel, pressed && local.panelActive]}
    >
      <HeaderIcon color={colors.textSecondary}>
        <Path d="M5 5v14m7-12-5 5 5 5m6-10-5 5 5 5" />
      </HeaderIcon>
    </Pressable>
  );
}

const local = StyleSheet.create({
  panel: { alignItems: "center", borderRadius: radii.sm, height: 28, justifyContent: "center", width: 28 },
  panelActive: { backgroundColor: colors.controlActive },
  separator: { alignSelf: "stretch", backgroundColor: colors.edge, marginVertical: 4, width: 1 },
});
