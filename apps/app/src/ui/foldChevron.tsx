import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../foundation/theme";

/**
 * The app's fold mark: a plain chevron, pointing right while the group is folded and down while it is open. The
 * sidebar's rows and the Companions tab's folds use it.
 */
export function FoldChevron({
  color = colors.text,
  isOpen,
  size = 22,
}: {
  color?: string;
  isOpen: boolean;
  size?: number;
}) {
  return (
    <View style={isOpen && local.open}>
      <Svg
        fill="none"
        height={size}
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
        width={size}
      >
        <Path d="M9 6l6 6-6 6" />
      </Svg>
    </View>
  );
}

const local = StyleSheet.create({ open: { transform: [{ rotate: "90deg" }] } });
