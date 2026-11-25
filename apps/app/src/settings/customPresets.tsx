import type { HarnessList, Tier } from "@outlore/contracts";
import { Pressable, Text, View } from "react-native";
import { runnerSummaryOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { companionStyles } from "./companionStyles";
import type { WorkshopFocus, WorkshopPreset } from "./workshopTabs";

/**
 * The custom presets as a list, under the three built-in tiers' tabs: one row for each, the one shown marked, and a
 * row that starts a new one. A list stays readable however many there are, as a row of tabs does not.
 */
export function CustomPresets({
  harnesses,
  isDraft,
  onAdd,
  onFocus,
  presets,
  selected,
}: {
  harnesses: HarnessList | null;
  isDraft: boolean;
  onAdd: () => void;
  onFocus: (focus: WorkshopFocus) => void;
  presets: ReadonlyArray<{ focus: WorkshopPreset; name: string; stack: Tier | null }>;
  selected: WorkshopFocus;
}) {
  return (
    <View style={companionStyles.custom}>
      <Text style={companionStyles.title}>Custom</Text>
      {presets.length === 0 && !isDraft && <Text style={companionStyles.note}>None yet.</Text>}
      {presets.map(({ focus, name, stack }) => {
        const isSelected = !isDraft && focus === selected;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={focus}
            onPress={() => onFocus(focus)}
            style={[companionStyles.customRow, isSelected && companionStyles.tabActive]}
          >
            <Text numberOfLines={1} style={[companionStyles.customName, isSelected && companionStyles.tabTextActive]}>
              {name}
            </Text>
            {stack !== null && (
              <Text numberOfLines={1} style={companionStyles.customSummary}>
                {runnerSummaryOf(harnesses, stack)}
              </Text>
            )}
          </Pressable>
        );
      })}
      {isDraft ? (
        <View style={[companionStyles.customRow, companionStyles.tabActive]}>
          <Text style={[companionStyles.customName, companionStyles.tabTextActive]}>New preset</Text>
          <Text style={companionStyles.customSummary}>Not saved yet</Text>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onAdd} style={companionStyles.customRow}>
          <Text style={styles.link}>+ Add preset</Text>
        </Pressable>
      )}
    </View>
  );
}
