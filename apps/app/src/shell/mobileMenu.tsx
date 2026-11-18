import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { type Place, phonePlaces } from "./placeCatalog";

// The menu of a narrow window, a phone's: the whole screen under the top bar, one large row per place. Quests are not
// listed here; the Realms row opens the page that lists them.

/** The places as large rows; `place` is the one the owner is on, highlighted, and a choice goes to `onPlace`. */
export function MobileMenu({ onPlace, place }: { onPlace: (place: Place) => void; place: Place | null }) {
  return (
    <ScrollView accessibilityLabel="Menu" contentContainerStyle={local.list} style={local.menu}>
      {phonePlaces.map((entry) => {
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
    </ScrollView>
  );
}

const local = StyleSheet.create({
  arrow: { color: colors.textMuted, fontSize: fontSizes.xl },
  label: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "600" },
  list: { gap: 2, padding: 12 },
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
