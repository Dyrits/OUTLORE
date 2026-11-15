import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { NavIcon } from "./navIcons";
import { type Place, placeGroups } from "./placeCatalog";

// The menu of a narrow window, a phone's: the whole screen under the top bar, one large row per place. Quests are not
// listed here; the Realms and Borderlands rows open the pages that list them.

/** The places as large rows; `place` is the one the owner is on, highlighted, and a choice goes to `onPlace`. */
export function MobileMenu({ onPlace, place }: { onPlace: (place: Place) => void; place: Place | null }) {
  return (
    <ScrollView accessibilityLabel="Menu" contentContainerStyle={local.list} style={local.menu}>
      {placeGroups.map((group, index) => (
        <View key={group[0]?.place} style={[local.group, index > 0 && local.groupSplit]}>
          {group.map((entry) => {
            const isHere = place === entry.place;
            return (
              <Pressable
                accessibilityLabel={entry.label}
                accessibilityRole="button"
                accessibilityState={{ selected: isHere }}
                key={entry.place}
                onPress={() => onPlace(entry.place)}
                style={({ pressed }) => [local.row, (isHere || pressed) && local.rowActive]}
              >
                <NavIcon name={entry.icon} size={30} />
                <View style={local.text}>
                  <Text style={local.label}>{entry.label}</Text>
                  <Text numberOfLines={1} style={local.note}>
                    {entry.note}
                  </Text>
                </View>
                <Text style={local.arrow}>›</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  arrow: { color: colors.textMuted, fontSize: fontSizes.xl },
  group: { gap: 2 },
  groupSplit: { borderColor: colors.edge, borderTopWidth: 1, marginTop: 10, paddingTop: 10 },
  label: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "600" },
  list: { padding: 12 },
  menu: { backgroundColor: colors.page, flex: 1 },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  row: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 14,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowActive: { backgroundColor: colors.controlActive },
  text: { flex: 1, gap: 1 },
});
