import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";

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
      <Text style={styles.muted}>{name}</Text>
    </Pressable>
  ));
  return isTouch ? (
    <ScrollView accessibilityLabel="Pane views" accessibilityRole="tablist" horizontal style={local.scroller}>
      {tabs}
    </ScrollView>
  ) : (
    <View accessibilityLabel="Pane views" accessibilityRole="tablist" style={local.tabs}>
      {tabs}
    </View>
  );
}

const local = StyleSheet.create({
  scroller: { flexGrow: 0 },
  selected: { borderBottomColor: colors.highlight },
  tab: { borderBottomColor: "transparent", borderBottomWidth: 2, paddingHorizontal: 8, paddingVertical: 6 },
  tabs: { flexDirection: "row", flexWrap: "wrap" },
  touchTab: { justifyContent: "center", minHeight: 44, paddingHorizontal: 14 },
});
