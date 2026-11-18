import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { canHover } from "../foundation/inputModality";
import { stateTones } from "../foundation/theme";
import { Chevron, useRowActions } from "./railActions";
import { isHovered, local } from "./railStyles";
/** The link under a group that lists only some of its quests: it leads to the page that lists them all. */
export function ShowAll({ count, onPress, subject }: { count: number; onPress: () => void; subject: string }) {
  return (
    <Pressable
      accessibilityLabel={`Show all ${count} quests of ${subject}`}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [local.more, (state.pressed || isHovered(state)) && local.rowHovered]}
    >
      <Text style={local.moreText}>Show all {count} quests</Text>
      <Text style={local.moreArrow}>→</Text>
    </Pressable>
  );
}

/** One row of the sidebar: a label, and at its end a mark such as a state dot or a count. */
export function Row({
  accessory,
  hoverAccessory,
  indent = 0,
  isButton = false,
  leading,
  isSelected,
  fold,
  label,
  onPress,
  textStyle,
}: {
  accessory?: ReactNode;
  /** What stands at the end only with the row's marks, on hover or focus, given whether they show. */
  hoverAccessory?: (isShown: boolean) => ReactNode;
  indent?: number;
  /** Whether the row is an action rather than a place: it has a thin rounded border and fills softly on hover. */
  isButton?: boolean;
  /** What stands before the label, after the fold mark, such as a state dot. */
  leading?: ReactNode;
  isSelected: boolean;
  label: string;
  /** The fold mark before the label of a quest or errand row; null `onPress` keeps its place empty. */
  fold?: { isOpen: boolean; label: string; onPress: (() => void) | null };
  onPress: () => void;
  textStyle?: object;
}) {
  const { focusProps, isShown, rowProps } = useRowActions();
  return (
    <Pressable
      {...rowProps}
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [
        local.row,
        !canHover && local.rowTouch,
        { paddingLeft: 6 + indent },
        isButton && local.buttonRest,
        (state.pressed || isHovered(state)) && (isButton ? local.buttonHovered : local.rowHovered),
        isSelected && local.rowSelected,
      ]}
    >
      {fold !== undefined && <Chevron {...fold} focusProps={focusProps} isShown={isShown} />}
      {leading}
      <Text numberOfLines={1} style={[local.rowText, isSelected && local.rowTextSelected, textStyle]}>
        {label}
      </Text>
      {accessory}
      {hoverAccessory?.(isShown)}
    </Pressable>
  );
}

/** A state's dot: the color the state reads in everywhere else. */
export function StateDot({ state }: { state: keyof typeof stateTones }) {
  return <View style={[local.dot, { backgroundColor: stateTones[state].color }]} />;
}

/** The number at the end of a row, such as a realm's or the archive's quests: shown, like the row's marks, on hover or focus. */
export function Count({ isShown, value }: { isShown: boolean; value: number }) {
  return value > 0 ? <Text style={[local.count, !isShown && local.actionsHidden]}>{value}</Text> : null;
}

/** The line between two parts of the sidebar, with a diamond at its middle (as before CHG-0453). */
export function Divider() {
  return (
    <View style={local.divider}>
      <View style={local.dividerLine} />
      <View style={local.diamond} />
      <View style={local.dividerLine} />
    </View>
  );
}
