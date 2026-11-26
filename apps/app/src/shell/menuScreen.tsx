import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { usePillScroll } from "../foundation/pillScroll";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { PhoneIcon, type PhoneIconName } from "./phoneIcons";
import { menuPlaces, type Place } from "./placeCatalog";

/** The icon each place of the Menu carries. */
const iconOf: Partial<Record<Place, PhoneIconName>> = {
  Archived: "archive",
  Lore: "lore",
  Reserves: "gauge",
  Settings: "gear",
};

/**
 * The narrow window's Menu (CHG-0760): the places the three tabs do not cover, as tiles. A Ritual is one of its
 * realm's things, not a place (CHG-0616), so it stays in its realm's rows on the Quests tab.
 */
export function MenuScreen({ onOpen }: { onOpen: (place: Place) => void }) {
  const pill = usePillScroll();
  return (
    <ScrollView
      {...pill.scrollProps}
      accessibilityLabel="Menu"
      contentContainerStyle={[local.tiles, pill.contentStyle]}
      style={local.page}
    >
      {menuPlaces.map((entry) => (
        <Pressable
          accessibilityLabel={`${entry.label}. ${entry.note}`}
          accessibilityRole="button"
          key={entry.place}
          onPress={() => onOpen(entry.place)}
          style={({ pressed }) => [local.tile, pressed && local.tilePressed]}
        >
          <PhoneIcon color={colors.accentText} name={iconOf[entry.place] ?? "grid"} />
          <View>
            <Text style={local.label}>{entry.label}</Text>
            <Text style={local.note}>{entry.note}</Text>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  label: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, marginTop: 2 },
  page: { backgroundColor: colors.page, flex: 1 },
  tile: {
    backgroundColor: colors.bubble,
    borderColor: colors.border,
    borderRadius: radii.xl,
    borderWidth: 1,
    flexBasis: "47%",
    flexGrow: 1,
    gap: 10,
    minHeight: 96,
    padding: 14,
  },
  tilePressed: { backgroundColor: colors.controlHover },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: 14 },
});
