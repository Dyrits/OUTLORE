import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { emblemPaths } from "../foundation/emblems";
import { colors, radii } from "../foundation/theme";

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
  onPress,
}: {
  isDisabled?: boolean;
  isDone: boolean;
  onPress: () => void;
}) {
  const color = isDone ? colors.accentText : colors.textSecondary;
  return (
    <Pressable
      accessibilityLabel={isDone ? "Mark as not done" : "Mark as done"}
      accessibilityRole="button"
      accessibilityState={{ checked: isDone, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
    >
      <HeaderIcon color={color}>
        <Rect height={16} rx={3} width={16} x={4} y={4} />
        {isDone && <Path d="M8.5 12.5l2.5 2.5 4.5-5.5" />}
      </HeaderIcon>
    </Pressable>
  );
}

/** A thin vertical line between the quest's own actions and the icon of its panel. */
export function HeaderSeparator() {
  return <View style={local.separator} />;
}

/**
 * Shows or hides the quest's panel in the right-hand column: the quest's sword, without the plus that starts a quest. It
 * keeps a fill while the column shows the quest's tab.
 */
export function QuestPanelButton({ isOpen, onPress }: { isOpen: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel={isOpen ? "Hide quest panel" : "Show quest panel"}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      onPress={onPress}
      style={({ pressed }) => [local.panel, (pressed || isOpen) && local.panelActive]}
    >
      <HeaderIcon color={isOpen ? colors.accentText : colors.textSecondary}>
        {emblemPaths.sword.map((path) => (
          <Path d={path} key={path} />
        ))}
      </HeaderIcon>
    </Pressable>
  );
}

const local = StyleSheet.create({
  panel: { alignItems: "center", borderRadius: radii.sm, height: 28, justifyContent: "center", width: 28 },
  panelActive: { backgroundColor: colors.controlActive },
  separator: { alignSelf: "stretch", backgroundColor: colors.edge, marginVertical: 4, width: 1 },
});
