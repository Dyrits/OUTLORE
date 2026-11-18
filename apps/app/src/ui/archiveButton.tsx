import { Pressable } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../foundation/theme";

/** The same archive icon for a quest's header and a realm's overview: a lidded box, drawn in the text's own color. */
export function ArchiveButton({
  isDisabled = false,
  label,
  onPress,
}: {
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={isDisabled} onPress={onPress}>
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
    </Pressable>
  );
}
