import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { colors, stateTones } from "../foundation/theme";
import { BowArrow } from "../ui/bowArrow";
import { NavIcon, type NavIconName } from "./navIcons";
import { Chevron, NewQuestIcon, OverviewButton, useRowActions } from "./railActions";
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
  icon,
  indent = 0,
  isMain = false,
  isSelected,
  fold,
  label,
  onPress,
  textStyle,
}: {
  accessory?: ReactNode;
  /** What stands at the end only with the row's marks, on hover or focus, given whether they show. */
  hoverAccessory?: (isShown: boolean) => ReactNode;
  /** The destination's icon, standing after an empty place for a chevron so it lines up with the headings'. */
  icon?: NavIconName;
  indent?: number;
  /** A main destination, set like a group's heading: its icon as large and its name in bold. */
  isMain?: boolean;
  isSelected: boolean;
  label: string;
  /** The fold mark before the label of a quest or side-quest row; null `onPress` keeps its place empty. */
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
        { paddingLeft: 6 + indent },
        // A main row's label starts where a heading's does: no gap after the icon, whose own margin spaces it.
        isMain && local.rowMain,
        (state.pressed || isHovered(state)) && local.rowHovered,
        isSelected && local.rowSelected,
      ]}
    >
      {fold !== undefined && <Chevron {...fold} focusProps={focusProps} isShown={isShown} />}
      {icon !== undefined && (
        <View style={local.headingIcon}>
          <NavIcon name={icon} size={isMain ? 28 : 22} />
        </View>
      )}
      <Text
        numberOfLines={1}
        style={[local.rowText, isSelected && local.rowTextSelected, isMain && local.rowTextMain, textStyle]}
      >
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

/**
 * The heading of a group, with controls for its page, contents, and creation where applicable.
 */
export function Heading({
  icon,
  isOpen,
  isSelected = false,
  label,
  note,
  onAdd,
  onNewQuest,
  onOverview,
  onPress,
  onToggle,
}: {
  icon: NavIconName;
  isSelected?: boolean;
  /** Set on a heading that folds the rows beneath it: whether they show. Left out, the heading has no chevron. */
  isOpen?: boolean;
  label: string;
  /** What the group is, for assistive technology; the heading shows only its name. */
  note: string;
  /** Makes a new one of what the group holds; null where that cannot be done yet, and the button is left out. */
  onAdd?: () => void;
  /** Starts a quest in the group, in the place of the add button, for a group whose quests need no realm made first. */
  onNewQuest?: () => void;
  onOverview?: () => void;
  onPress: () => void;
  onToggle?: () => void;
}) {
  const { actionsStyle, focusProps, isShown, rowProps } = useRowActions();
  return (
    <Pressable
      {...rowProps}
      accessibilityHint={note}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={isOpen === undefined ? {} : { expanded: isOpen }}
      onPress={onPress}
      style={(state) => [
        local.heading,
        (state.pressed || isHovered(state)) && local.rowHovered,
        isSelected && local.rowSelected,
      ]}
    >
      <View style={local.headingIcon}>
        <NavIcon name={icon} size={28} />
      </View>
      <View style={local.headingText}>
        <Text numberOfLines={1} style={local.headingTitle}>
          {label}
        </Text>
      </View>
      {isOpen !== undefined && (
        // Right after the title, and like the actions shown only on hover or focus; it keeps its place while unseen.
        <Pressable
          {...focusProps}
          accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${label}`}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          onPress={onToggle ?? onPress}
          style={[local.headingChevron, !isShown && local.actionsHidden]}
        >
          <BowArrow isOpen={isOpen} />
        </Pressable>
      )}
      <View style={local.flex} />
      <View style={actionsStyle}>
        {onOverview !== undefined && (
          <OverviewButton focusProps={focusProps} isMain label={label} onPress={onOverview} />
        )}
        {onAdd !== undefined && (
          <Pressable
            {...focusProps}
            accessibilityLabel={`New ${label.toLowerCase().replace(/s$/, "")}`}
            accessibilityRole="button"
            onPress={onAdd}
            style={(state) => [local.add, (state.pressed || isHovered(state)) && local.addHovered]}
          >
            <Text style={local.addMark}>+</Text>
          </Pressable>
        )}
        {onNewQuest !== undefined && (
          <Pressable
            {...focusProps}
            accessibilityLabel={`New quest in ${label.toLowerCase()}`}
            accessibilityRole="button"
            onPress={onNewQuest}
            style={(state) => [local.add, (state.pressed || isHovered(state)) && local.addHovered]}
          >
            <NewQuestIcon color={colors.highlight} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

/** The line between two main destinations of the sidebar, with a diamond at its middle. */
export function Divider() {
  return (
    <View style={local.divider}>
      <View style={local.dividerLine} />
      <View style={local.diamond} />
      <View style={local.dividerLine} />
    </View>
  );
}
