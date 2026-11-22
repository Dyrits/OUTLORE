import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors, radii } from "../foundation/theme";

/** Shows the menu button, conversation title and state, and available conversation actions in a narrow window. */
export function MobileHeader({ actions, onBack, title }: { actions: ReactNode; onBack: () => void; title: ReactNode }) {
  return (
    <View style={local.header}>
      <Pressable
        accessibilityLabel="Back to the menu"
        accessibilityRole="button"
        hitSlop={6}
        onPress={onBack}
        style={({ pressed }) => [local.control, pressed && local.controlPressed]}
      >
        <Svg
          fill="none"
          height={20}
          stroke={colors.textSecondary}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
          width={20}
        >
          <Path d="M15 6l-6 6 6 6" />
        </Svg>
      </Pressable>
      <View style={local.title}>{title}</View>
      <View style={local.actions}>{actions}</View>
    </View>
  );
}

const local = StyleSheet.create({
  actions: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", minWidth: 32 },
  control: { alignItems: "center", borderRadius: radii.md, height: 32, justifyContent: "center", width: 32 },
  controlPressed: { backgroundColor: colors.controlHover },
  header: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 32, paddingBottom: 4 },
  title: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" },
});
