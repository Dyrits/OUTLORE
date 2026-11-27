import { Pressable, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../foundation/theme";

/** A small icon button that launches a fenced shell command in the conversation's inline terminal. */
export function RunButton({
  label = "Run command",
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
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: 0.6 }]}
    >
      <Svg
        fill="none"
        height={16}
        stroke={colors.textMuted}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        width={16}
      >
        <Path d="M6 4l14 8-14 8V4z" />
      </Svg>
    </Pressable>
  );
}
