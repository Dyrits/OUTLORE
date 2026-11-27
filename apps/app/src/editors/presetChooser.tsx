import type { HarnessList } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { runnerSummaryOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, round } from "../foundation/theme";
import { ProviderMark } from "../ui/providerMarks";
import { customHint, customName, type PresetEntry } from "./presetEntries";
import type { Preset } from "./presets";

/**
 * The preset list of the Companions tab: a row for each preset, putting its whole stack in place with one press, and the Custom entry when the thread's stack is none of them.
 * Stacked, it is a card above the thread's Companion with the summary at each row's right; as a navigation (`isNav`), the left column of the split layout, with the summary under the name.
 */
export function PresetChooser({
  entries,
  harnesses,
  isNav,
  onPreset,
}: {
  entries: ReadonlyArray<PresetEntry>;
  harnesses: HarnessList | null;
  isNav: boolean;
  onPreset: (preset: Preset) => void;
}) {
  return (
    <View style={isNav ? local.nav : local.card}>
      <Text style={local.title}>{isNav ? "Presets" : "Preset"}</Text>
      <View accessibilityLabel="Companion presets" accessibilityRole="radiogroup">
        {entries.map((entry) => {
          const label = entry.kind === "custom" ? customName : entry.preset.name;
          const summary =
            entry.kind === "custom"
              ? customHint
              : `${runnerSummaryOf(harnesses, entry.preset.runner)} · ${countedOf(entry.preset.backups.length, "backup")}`;
          const rowStyle = [
            styles.menuItem,
            local.row,
            isNav && local.rowNav,
            entry.isChosen && styles.menuItemSelected,
          ];
          const content = (
            <>
              {entry.kind === "preset" ? <ProviderMark harness={entry.preset.runner.harness} size={14} /> : null}
              <View style={[local.text, isNav && local.textNav]}>
                <Text numberOfLines={1} style={[local.name, entry.isChosen && styles.chipTextSelected]}>
                  {label}
                </Text>
                <Text numberOfLines={isNav ? 2 : 1} style={[local.summary, isNav && local.summaryNav]}>
                  {summary}
                </Text>
              </View>
              {entry.isChosen && <Text style={styles.chipTextSelected}>✓</Text>}
            </>
          );
          // Custom is the thread's own state, so there is nothing to press.
          return entry.kind === "custom" ? (
            <View
              accessibilityLabel={`${customName} companion, ${customHint}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: true }}
              aria-checked={true}
              key="custom"
              style={rowStyle}
            >
              {content}
            </View>
          ) : (
            <Pressable
              accessibilityLabel={`Preset ${entry.preset.name}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: entry.isChosen }}
              aria-checked={entry.isChosen}
              key={entry.preset.name}
              onPress={() => onPreset(entry.preset)}
              style={({ pressed }) => [rowStyle, pressed && local.pressed]}
            >
              {content}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const local = StyleSheet.create({
  card: {
    ...outline,
    ...round,
    backgroundColor: colors.surface,
    gap: 4,
    paddingBottom: 6,
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  name: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  nav: { gap: 4 },
  pressed: { backgroundColor: colors.controlHover },
  row: { alignItems: "center", flexDirection: "row", gap: 8 },
  rowNav: { alignItems: "flex-start" },
  summary: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    textAlign: "right",
  },
  summaryNav: { flex: 0, textAlign: "left" },
  text: { alignItems: "center", flex: 1, flexDirection: "row", gap: 8, minWidth: 0 },
  textNav: { alignItems: "stretch", flexDirection: "column", gap: 0 },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
});
