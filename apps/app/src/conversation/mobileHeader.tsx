import type { ThreadState } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { styles } from "../foundation/styles";
import { colors, radii } from "../foundation/theme";
import { ArchiveButton } from "../ui/archiveButton";
import { StateIndicator } from "../ui/controls";

/**
 * A phone's quest header, in the app's own look: a back chevron that opens the main menu, the title with its state's dot
 * in the middle, and the archive button, each control in a square of the same size so the title stays centered.
 * `onArchive` is null where the thread cannot be archived, which leaves the place empty.
 */
export function MobileHeader({
  isArchiveDisabled,
  onArchive,
  onBack,
  state,
  title,
}: {
  isArchiveDisabled: boolean;
  onArchive: (() => void) | null;
  onBack: () => void;
  state: ThreadState;
  title: string;
}) {
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
      <View style={local.title}>
        <Text numberOfLines={1} style={[styles.paneTitle, local.titleText]}>
          {title}
        </Text>
        <StateIndicator state={state} />
      </View>
      <View style={local.control}>
        {onArchive !== null && (
          <ArchiveButton isDisabled={isArchiveDisabled} label="Archive quest" onPress={onArchive} />
        )}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  control: { alignItems: "center", borderRadius: radii.md, height: 32, justifyContent: "center", width: 32 },
  controlPressed: { backgroundColor: colors.controlHover },
  header: { alignItems: "center", flexDirection: "row", gap: 8, minHeight: 32, paddingBottom: 4 },
  title: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, justifyContent: "center" },
  titleText: { flexShrink: 1 },
});
