import { Pressable, StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";

/**
 * The tabs under a pane's header (conversation panes): one name is selected and its body shows beneath. A quest shows
 * Missives and Errands, a realm's channel Missives and Quests; a tab opens nothing of its own, it changes the pane's body.
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
    <View accessibilityRole="tablist" style={local.tabs}>
      {names.map((name) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: selected === name }}
          key={name}
          onPress={() => onSelect(name)}
          style={[local.tab, selected === name && local.selected]}
        >
          <Text style={[styles.muted, selected === name && local.selectedLabel]}>{name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const local = StyleSheet.create({
  selected: { borderBottomColor: colors.highlight },
  selectedLabel: { fontWeight: "700" },
  tab: { borderBottomColor: colors.edge, borderBottomWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  tabs: { flexDirection: "row" },
});
