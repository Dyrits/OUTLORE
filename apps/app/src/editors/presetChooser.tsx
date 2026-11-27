import type { HarnessList, Tier } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { runnerSummaryOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, outline, round } from "../foundation/theme";
import { ProviderMark } from "../ui/providerMarks";
import { chainLabelOf, chainOf } from "./presetChain";
import { customHint, customName, type PresetEntry } from "./presetEntries";
import type { Preset } from "./presets";

/**
 * The preset list of the Companions tab: a row for each preset, putting its whole stack in place with one press, and the Custom entry when the thread's stack is none of them.
 * Stacked, it is a card above the thread's Companion with the summary at each row's right; as a navigation (`isNav`), the left column of the split layout, with the summary under the name.
 */
export function PresetChooser({
  drafts = {},
  editing = null,
  entries,
  harnesses,
  isNav,
  isChainListed = isNav,
  notes = {},
  onPreset,
}: {
  /** A preset's unsaved chain from its edit mode: its row shows it, marked unsaved, until it is saved or discarded. */
  drafts?: Readonly<Record<string, Tier>>;
  /** The preset in edit mode: its row says so, apart from the check mark of the thread's own Companion. */
  editing?: string | null;
  entries: ReadonlyArray<PresetEntry>;
  harnesses: HarnessList | null;
  /** Whether each preset lists its models one under another; the navigation does, and so can the stacked card. */
  isChainListed?: boolean;
  isNav: boolean;
  /** A line to show under a preset's name in place of its chain, such as a tier not set yet. */
  notes?: Readonly<Record<string, string>>;
  onPreset: (preset: Preset) => void;
}) {
  return (
    <View style={isNav ? local.nav : local.card}>
      <Text style={local.title}>{isNav ? "Presets" : "Preset"}</Text>
      <View accessibilityLabel="Companion presets" accessibilityRole="radiogroup">
        {entries.map((entry) => {
          const label = entry.kind === "custom" ? customName : entry.preset.name;
          const isEditing = entry.kind === "preset" && entry.preset.name === editing;
          const unsaved = entry.kind === "preset" ? (drafts[entry.preset.name] ?? null) : null;
          const summary =
            entry.kind === "custom"
              ? customHint
              : unsaved !== null
                ? `unsaved · ${countedOf(unsaved.backups.length, "backup")}`
                : `${runnerSummaryOf(harnesses, entry.preset.runner)} · ${countedOf(entry.preset.backups.length, "backup")}`;
          const chain =
            isChainListed && entry.kind === "preset" && notes[entry.preset.name] === undefined
              ? chainOf(unsaved ?? { ...entry.preset.runner, backups: entry.preset.backups })
              : [];
          const rowStyle = [
            styles.menuItem,
            local.row,
            isChainListed && local.rowNav,
            entry.isChosen && styles.menuItemSelected,
          ];
          const content = (
            <>
              {entry.kind === "preset" ? <ProviderMark harness={entry.preset.runner.harness} size={14} /> : null}
              <View style={[local.text, isChainListed && local.textNav]}>
                <Text numberOfLines={1} style={[local.name, entry.isChosen && styles.chipTextSelected]}>
                  {label}
                </Text>
                {(chain.length === 0 || unsaved !== null || isEditing) && (
                  <Text
                    numberOfLines={isChainListed ? 2 : 1}
                    style={[local.summary, isChainListed && local.summaryNav]}
                  >
                    {unsaved !== null
                      ? isEditing
                        ? "editing · unsaved"
                        : "unsaved"
                      : isEditing
                        ? "editing"
                        : (notes[entry.kind === "preset" ? entry.preset.name : ""] ?? summary)}
                  </Text>
                )}
                {chain.map((runner, index) => (
                  // A Companion has no identity but its place in the chain.
                  // biome-ignore lint/suspicious/noArrayIndexKey: see above
                  <View key={index} style={local.chainRow}>
                    <ProviderMark harness={runner.harness} size={12} />
                    <Text style={local.chainLabel}>{chainLabelOf(harnesses, runner)}</Text>
                  </View>
                ))}
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
  chainLabel: { color: colors.textMuted, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  chainRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 2 },
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
