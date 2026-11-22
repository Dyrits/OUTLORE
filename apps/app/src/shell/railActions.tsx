import { type ElementRef, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { emblemPaths } from "../foundation/emblems";
import { canHover, isKeyboardFocus } from "../foundation/inputModality";
import { isPointerOver } from "../foundation/pointerPosition";
import { colors } from "../foundation/theme";
import { FoldChevron } from "../ui/foldChevron";
import { areActionsShown, folderCueOf } from "./questTree";

import { isHovered, local } from "./railStyles";
/**
 * The mark that folds or unfolds what lies beneath a realm, quest, or errand row.
 * A row with nothing beneath it keeps the chevron's place empty.
 */
export function Chevron({
  focusProps,
  isOpen,
  isShown,
  label,
  onPress,
}: {
  focusProps: FocusProps;
  isOpen: boolean;
  isShown: boolean;
  label: string;
  /** Null where nothing lies beneath the row. */
  onPress: (() => void) | null;
}) {
  if (onPress === null) return <View style={local.chevron} />;
  return (
    <Pressable
      {...focusProps}
      accessibilityLabel={`${isOpen ? "Collapse" : "Expand"} ${label}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      hitSlop={6}
      onPress={onPress}
      style={[local.chevron, !isShown && local.actionsHidden]}
    >
      <FoldChevron color={colors.textMuted} isOpen={isOpen} size={15} />
    </Pressable>
  );
}

/** The sword that marks a quest elsewhere, with a plus in its open corner: the mark of starting a quest. */
export function NewQuestIcon({ color }: { color: string }) {
  return <CreationIcon color={color} paths={emblemPaths.sword} plus="M6 2.5v6M3 5.5h6" />;
}

/** A plain plus: the mark of visiting a new realm. */
export function NewRealmIcon({ color }: { color: string }) {
  return <CreationIcon color={color} paths={["M12 5v14", "M5 12h14"]} />;
}

/** The moon that marks a Ritual elsewhere, with a plus inside the crescent's opening: the mark of scheduling a Ritual (CHG-0616). */
export function NewRitualIcon({ color }: { color: string }) {
  return <CreationIcon color={color} paths={emblemPaths.moon} plus="M15 6v6M12 9h6" />;
}

function CreationIcon({ color, paths, plus }: { color: string; paths: readonly string[]; plus?: string }) {
  return (
    <Svg
      fill="none"
      height={18}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={18}
    >
      {paths.map((path) => (
        <Path d={path} key={path} />
      ))}
      {plus !== undefined && <Path d={plus} />}
    </Svg>
  );
}

/** The mark of archiving a quest: an archive box. */
export function ArchiveIcon({ color }: { color: string }) {
  return (
    <LineIcon color={color}>
      <Path d="M3 4h18v4H3z" />
      <Path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <Path d="M10 12h4" />
    </LineIcon>
  );
}

export { DeleteIcon } from "../ui/archiveButton";

function LineIcon({ children, color }: { children: ReactNode; color: string }) {
  return (
    <Svg
      fill="none"
      height={15}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={15}
    >
      {children}
    </Svg>
  );
}

/**
 * The small folder before the name of a realm tied to a folder (CHG-0161, CHG-0170); a realm tied to none has no mark. Hovering
 * shows the folder's full path: react-native-web passes no `title` on, so the web build sets it on the element itself.
 */
export function FolderCue({ path }: { path: string | null }) {
  const cue = folderCueOf({ path });
  if (cue === null) return null;
  const setTitle = (element: unknown) => {
    const node = element as { setAttribute?: (name: string, value: string) => void } | null;
    if (Platform.OS === "web") node?.setAttribute?.("title", cue);
  };
  return (
    <View accessibilityLabel={cue} ref={setTitle} style={local.folderCue}>
      <Svg
        fill="none"
        height={15}
        stroke={colors.textMuted}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={15}
      >
        <Path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      </Svg>
    </View>
  );
}

/** What an action button needs to keep its row's actions showing while it has the keyboard focus. */
type FocusProps = { readonly onBlur: () => void; readonly onFocus: () => void };

/**
 * A row's hover and keyboard focus, so its action buttons show only then (`areActionsShown`). The buttons keep their
 * place while unseen, so nothing moves when they appear; the row gets `rowProps`, each button and the row `focusProps`.
 */
export const useRowActions = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [hasKeyboardFocusWithin, setHasKeyboardFocusWithin] = useState(false);
  const rowRef = useRef<ElementRef<typeof View>>(null);
  // A row that moved under a still pointer (the one above it was archived) hears no pointer enter: look at where the
  // pointer is after each render, once the row has its place.
  useLayoutEffect(() => {
    if (canHover) setIsHovered(isPointerOver(rowRef.current));
  });
  // Only a keyboard focus shows them: the focus a click leaves behind does not, once the pointer moves away.
  const focusProps: FocusProps = {
    onBlur: () => setHasKeyboardFocusWithin(false),
    onFocus: () => setHasKeyboardFocusWithin(isKeyboardFocus()),
  };
  const isShown = areActionsShown({ canHover, hasKeyboardFocusWithin, isHovered });
  return {
    actionsStyle: [local.actions, !isShown && local.actionsHidden],
    focusProps,
    isShown,
    // Pointer enter and leave, not Pressable's hover: React Native Web ends a Pressable's hover as soon as the pointer
    // reaches a Pressable inside it (a hidden button, the fold arrow), so the marks vanished exactly where they appear.
    // Enter and leave fire only when the pointer crosses the row's own edge, so the whole row box counts.
    rowProps: {
      ...focusProps,
      onPointerEnter: () => setIsHovered(true),
      onPointerLeave: () => setIsHovered(false),
      ref: rowRef,
    },
  };
};

/** Opens a group's overview without changing its folded state. */
export function OverviewButton({
  focusProps,
  isMain = false,
  label,
  onPress,
}: {
  focusProps: FocusProps;
  isMain?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      {...focusProps}
      accessibilityLabel={`Open ${label} overview`}
      accessibilityRole="button"
      hitSlop={4}
      onPress={onPress}
      style={(state) => [
        isMain ? local.add : local.newQuest,
        (state.pressed || isHovered(state)) && (isMain ? local.addHovered : local.newQuestHovered),
      ]}
    >
      <Svg
        fill="none"
        height={18}
        stroke={colors.textMuted}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={18}
      >
        <Path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <Circle cx={12} cy={12} r={3} />
      </Svg>
    </Pressable>
  );
}
