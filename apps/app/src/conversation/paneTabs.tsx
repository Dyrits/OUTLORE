import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, fontSizes, radii } from "../foundation/theme";

/**
 * The tabs under a pane's header select the body shown within that pane.
 */
export function PaneTabs<Name extends string>({
  isTouch = false,
  names,
  onSelect,
  selected,
}: {
  isTouch?: boolean;
  names: ReadonlyArray<Name>;
  onSelect: (name: Name) => void;
  selected: Name;
}) {
  const tabs = names.map((name) => (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: selected === name }}
      key={name}
      onPress={() => onSelect(name)}
      style={[local.tab, isTouch && local.touchTab, selected === name && local.selected]}
    >
      <Text style={[styles.muted, local.label, selected === name && local.selectedLabel]}>{name}</Text>
    </Pressable>
  ));
  return isTouch ? (
    <ScrollView
      accessibilityLabel="Pane views"
      accessibilityRole="tablist"
      contentContainerStyle={local.track}
      horizontal
      style={local.scroller}
    >
      {tabs}
    </ScrollView>
  ) : (
    <View accessibilityLabel="Pane views" accessibilityRole="tablist" style={[local.track, local.tabs]}>
      {tabs}
    </View>
  );
}

/** A segmented control: a rounded track holds the tabs, and the selected tab is a raised pill. */
const local = StyleSheet.create({
  label: { fontSize: fontSizes.md },
  scroller: { flexGrow: 0 },
  selected: { backgroundColor: colors.controlActive },
  selectedLabel: { color: colors.text },
  tab: { borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 5 },
  tabs: { alignSelf: "flex-start", flexWrap: "wrap" },
  touchTab: { justifyContent: "center", minHeight: 36, paddingHorizontal: 14 },
  track: { backgroundColor: colors.control, borderRadius: radii.lg, flexDirection: "row", gap: 2, padding: 3 },
});
