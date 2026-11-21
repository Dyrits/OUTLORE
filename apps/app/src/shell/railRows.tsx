import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { canHover } from "../foundation/inputModality";
import { stateTones } from "../foundation/theme";
import { Chevron, useRowActions } from "./railActions";
import { isHovered, local } from "./railStyles";
/** Opens the list for a group of quests or errands. */
export function ShowAll({ label, onPress, subject }: { label: string; onPress: () => void; subject: string }) {
  return (
    <Pressable
      accessibilityLabel={`${label} · ${subject}`}
      accessibilityRole="button"
      onPress={onPress}
      style={(state) => [local.more, (state.pressed || isHovered(state)) && local.rowHovered]}
    >
      <Text style={local.moreText}>{label}</Text>
      <Text style={local.moreArrow}>→</Text>
    </Pressable>
  );
}

/** A mark at a row's lower-left corner: its color, and its size as a share of the row's width and height. */
export type RowCorner = { readonly color: string; readonly share: number };

/** One row of the sidebar: a label, and at its end a mark such as a state dot or a count. */
export function Row({
  corners,
  hoverAccessory,
  indent = 0,
  leading,
  isSelected,
  fold,
  label,
  onPress,
  textStyle,
}: {
  /** What stands at the end only with the row's marks, on hover or focus, given whether they show. */
  hoverAccessory?: (isShown: boolean) => ReactNode;
  indent?: number;
  /** What stands before the label, after the fold mark, such as a state dot. */
  leading?: ReactNode;
  isSelected: boolean;
  label: string;
  /** The fold mark before the label of a quest or errand row; null `onPress` keeps its place empty. */
  fold?: { isOpen: boolean; label: string; onPress: (() => void) | null };
  onPress: () => void;
  /**
   * The marks at the row's lower-left corner, drawn in order so a smaller one sits over a larger one. A border cannot
   * cover part of a side, so each mark is drawn over the row.
   */
  corners?: readonly RowCorner[];
  textStyle?: object;
}) {
  const { focusProps, isShown, rowProps } = useRowActions();
  return (
    <Pressable
      {...rowProps}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={(state) => [
        local.row,
        !canHover && local.rowTouch,
        local.rowQuest,
        { paddingLeft: 5 + indent },
        (state.pressed || isHovered(state)) && local.rowHovered,
        isSelected && local.rowSelected,
      ]}
    >
      {fold !== undefined && <Chevron {...fold} focusProps={focusProps} isShown={isShown} />}
      {leading}
      <Text numberOfLines={1} style={[local.rowText, isSelected && local.rowTextSelected, textStyle]}>
        {label}
      </Text>
      {hoverAccessory?.(isShown)}
      {corners?.map(({ color, share }) => (
        <View
          key={share}
          pointerEvents="none"
          style={[local.corner, { borderColor: color, height: `${share}%`, width: `${share}%` }]}
        />
      ))}
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
