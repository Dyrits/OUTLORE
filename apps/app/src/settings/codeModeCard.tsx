import type { Settings, SettingsChange } from "@outlore/contracts";
import { StyleSheet, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { ToggleRow } from "../ui/toggleRow";
import { codeModeExplanation, codeModeLabel, codeModeStateOf, experimentalLabel } from "./codeMode";
import { SettingsCard } from "./settingsParts";

/**
 * The Borderlands tab's global Code Mode switch. It reads and writes `shouldUseCodeMode` like every other
 * setting, so a change made on another device shows here too.
 */
export function CodeModeCard({ onSave, settings }: { onSave: (change: SettingsChange) => void; settings: Settings }) {
  return (
    <SettingsCard icon="code" title="Code Mode">
      <View style={local.switchRow}>
        <ToggleRow
          label={codeModeLabel}
          onChange={(shouldUseCodeMode) => onSave({ shouldUseCodeMode })}
          value={settings.shouldUseCodeMode}
        />
        <View style={local.tag}>
          <Text style={local.tagText}>{experimentalLabel}</Text>
        </View>
      </View>
      <Text style={styles.body}>{codeModeStateOf(settings.shouldUseCodeMode)}</Text>
      <Text style={local.explanation}>{codeModeExplanation}</Text>
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  explanation: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.base },
  switchRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tag: { backgroundColor: colors.controlActive, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "700" },
});
