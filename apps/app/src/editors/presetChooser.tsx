import type { HarnessList, Tier } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { runnerSummaryOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";
import { handCursor } from "../ui/pointer";
import { ProviderMark } from "../ui/providerMarks";
import { chainOf, chainPartsOf } from "./presetChain";
import type { PresetEntry } from "./presetEntries";
import type { Preset } from "./presets";
import { ownValue } from "./useDraftStack";

/**
 * The companion list: one card for each saved companion with its numbered fallback chain and right-aligned efforts,
 * plus an optional dashed "+ Add a companion" action at the foot.
 */
export function PresetChooser({
  drafts = {},
  entries,
  harnesses,
  isAdding = false,
  isChainListed = true,
  notes = {},
  onAdd,
  onPreset,
}: {
  /** A companion's unsaved chain: its card previews the draft, marked unsaved, until it is saved or discarded. */
  drafts?: Readonly<Record<string, Tier>>;
  entries: ReadonlyArray<PresetEntry>;
  harnesses: HarnessList | null;
  /** Whether a new unsaved companion is currently being drafted. */
  isAdding?: boolean;
  /** Whether each card lists its numbered models one under another. */
  isChainListed?: boolean;
  /** A line to show under a companion's name in place of its chain, such as a tier not set yet. */
  notes?: Readonly<Record<string, string>>;
  /** Starts a new unsaved companion draft from the dashed button at the foot of the list. */
  onAdd?: () => void;
  onPreset: (preset: Preset, id: string) => void;
}) {
  return (
    <View style={local.list}>
      <View accessibilityLabel="Companion presets" accessibilityRole="radiogroup" style={local.list}>
        {entries.map((entry) => {
          const entryKey = entry.id ?? entry.preset.name;
          const unsaved = ownValue(drafts, entryKey);
          const note = ownValue(notes, entryKey);
          const summary =
            unsaved !== null
              ? `unsaved · ${countedOf(unsaved.backups.length, "backup")}`
              : `${runnerSummaryOf(harnesses, entry.preset.runner)} · ${countedOf(entry.preset.backups.length, "backup")}`;
          const chain =
            isChainListed && note === null
              ? chainOf(unsaved ?? { ...entry.preset.runner, backups: entry.preset.backups })
              : [];
          const isSelected = !isAdding && entry.isChosen;
          return (
            <Pressable
              accessibilityLabel={`Preset ${entry.preset.name}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              aria-checked={isSelected}
              key={entryKey}
              onPress={() => onPreset(entry.preset, entryKey)}
              style={({ pressed }) => [
                local.card,
                isSelected && local.cardSelected,
                pressed && !isSelected && local.cardPressed,
              ]}
            >
              <View style={local.cardHeader}>
                <Text numberOfLines={1} style={[local.name, isSelected && local.nameSelected]}>
                  {entry.preset.name}
                </Text>
                {unsaved !== null && <Text style={local.unsaved}>unsaved</Text>}
              </View>
              {note !== null ? (
                <Text style={local.note}>{note}</Text>
              ) : chain.length > 0 ? (
                <View style={local.chain}>
                  {chain.map((runner, index) => {
                    const parts = chainPartsOf(harnesses, runner);
                    return (
                      // A Companion has no identity but its place in the chain.
                      // biome-ignore lint/suspicious/noArrayIndexKey: see above
                      <View key={index} style={local.chainRow}>
                        <View style={[local.indexBadge, isSelected && local.indexBadgeSelected]}>
                          <Text style={local.indexText}>{index + 1}</Text>
                        </View>
                        <ProviderMark harness={runner.harness} size={14} />
                        <Text numberOfLines={1} style={[local.chainLabel, isSelected && local.chainLabelSelected]}>
                          {parts.label}
                        </Text>
                        {parts.effort !== "" && <Text style={local.effort}>{parts.effort}</Text>}
                      </View>
                    );
                  })}
                </View>
              ) : (
                <Text numberOfLines={1} style={local.note}>
                  {summary}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {isAdding ? (
        <View style={[local.card, local.cardSelected]}>
          <View style={local.cardHeader}>
            <Text numberOfLines={1} style={[local.name, local.nameSelected]}>
              New companion
            </Text>
            <Text style={local.unsaved}>unsaved</Text>
          </View>
          <Text style={local.note}>Not saved yet</Text>
        </View>
      ) : onAdd !== undefined ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAdd}
          style={({ pressed }) => [local.addButton, pressed && local.cardPressed]}
        >
          <Text style={local.addText}>+ Add a companion</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const local = StyleSheet.create({
  addButton: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.lg,
    borderStyle: "dashed",
    borderWidth: 1,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...handCursor,
  },
  addText: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  card: {
    ...outline,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: 8,
    padding: 12,
    ...handCursor,
  },
  cardHeader: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "space-between" },
  cardPressed: { backgroundColor: colors.controlHover },
  cardSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  chain: { gap: 5 },
  chainLabel: { color: colors.textSecondary, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.sm, minWidth: 0 },
  chainLabelSelected: { color: colors.text },
  chainRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  effort: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  indexBadge: {
    alignItems: "center",
    backgroundColor: colors.control,
    borderRadius: radii.pill,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  indexBadgeSelected: { backgroundColor: colors.controlActive },
  indexText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 10, fontWeight: "600" },
  list: { gap: 10 },
  name: { color: colors.text, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  nameSelected: { color: colors.accentText },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  unsaved: { color: colors.accentText, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
});
