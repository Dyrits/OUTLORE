import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";

/**
 * The tabs under a pane's header select the body shown within that pane.
 */
export function PaneTabs<Name extends string>({
  names,
  onSelect,
  selected,
}: {
  names: ReadonlyArray<Name>;
  onSelect: (name: Name) => void;
  selected: Name;
}) {
  return (
    <View accessibilityLabel="Pane views" accessibilityRole="tablist" style={local.tabs}>
      {names.map((name) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === name }}
          key={name}
          onPress={() => onSelect(name)}
          style={[local.tab, selected === name && local.selected]}
        >
          <Text style={styles.muted}>{name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  selected: { borderBottomColor: colors.highlight },
  tab: { borderBottomColor: "transparent", borderBottomWidth: 2, paddingHorizontal: 8, paddingVertical: 6 },
  tabs: { flexDirection: "row", flexWrap: "wrap" },
});
