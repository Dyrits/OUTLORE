import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { NavIcon, type NavIconName } from "./navIcons";
import type { Place } from "./sidebar";

// The menu of a narrow window, a phone's: the whole screen under the top bar, one large row per place. Quests are not
// listed here; the Realms and Borderlands rows open the pages that list them.

type Entry = { icon: NavIconName; label: string; note: string; place: Place };

/** The menu's rows in groups, set apart by a line, in the sidebar's order. */
const groups: ReadonlyArray<ReadonlyArray<Entry>> = [
  [
    { icon: "guild-hall", label: "Guild Hall", note: "What waits for you and what happened", place: "Guildmaster" },
    { icon: "realms", label: "Realms", note: "Quests sharing lore, by realm", place: "Realms" },
    { icon: "borderlands", label: "Borderlands", note: "Quests with no realm", place: "Borderlands" },
  ],
  [
    { icon: "rituals", label: "Rituals", note: "Orders that run by themselves", place: "Rituals" },
    { icon: "craft", label: "Craft", note: "Reusable procedures", place: "Craft" },
  ],
  [
    { icon: "library", label: "Library", note: "Artifacts your quests made", place: "Library" },
    { icon: "lore", label: "Lore", note: "What quests remember", place: "Lore" },
    { icon: "archive", label: "Archive", note: "Archived quests", place: "Archived" },
  ],
  [
    { icon: "reserves", label: "Reserves", note: "Usage and budgets", place: "Reserves" },
    { icon: "charter", label: "Charter", note: "Devices and relays", place: "Charter" },
    { icon: "workshop", label: "Workshop", note: "Accounts, Companions, and looks", place: "Settings" },
  ],
];

/** The places as large rows; `place` is the one the owner is on, highlighted, and a choice goes to `onPlace`. */
export function MobileMenu({ onPlace, place }: { onPlace: (place: Place) => void; place: Place | null }) {
  return (
    <ScrollView accessibilityLabel="Menu" contentContainerStyle={local.list} style={local.menu}>
      {groups.map((group, index) => (
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
