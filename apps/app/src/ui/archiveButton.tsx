import { Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../foundation/theme";

/** The archive action for a quest or realm, with the bin icon when the action deletes empty work. */
export function ArchiveButton({
  isDelete = false,
  isDisabled = false,
  label,
  onPress,
}: {
  isDelete?: boolean;
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={isDisabled} onPress={onPress}>
      {isDelete ? (
        <DeleteIcon color={colors.textSecondary} size={20} />
      ) : (
        <Svg
          fill="none"
          height={20}
          stroke={colors.textSecondary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          width={20}
        >
          <Path d="M3 4h18v4H3z" />
          <Path d="M5 8v11h14V8" />
          <Path d="M10 12h4" />
        </Svg>
      )}
    </Pressable>
  );
}

/** The bin used for deleting an empty quest or errand. */
export function DeleteIcon({ color, size = 15 }: { color: string; size?: number }) {
  return (
    <Svg
      fill="none"
      height={size}
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={size}
    >
      <Path d="M4 7h16" />
      <Path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
      <Path d="M9 7V4h6v3" />
    </Svg>
  );
}
