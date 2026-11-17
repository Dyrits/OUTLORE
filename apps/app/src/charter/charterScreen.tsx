import type { SettingsChange } from "@outlore/contracts";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { SettingsCard, SettingsHeading, ToggleRow } from "../settings/settingsParts";
import { codeModeExplanation, codeModeLabel, codeModeStateOf, experimentalLabel } from "./codeMode";

/**
 * The Charter: for now only its Connectors section, holding the one global Code Mode switch (connectors). The settings
 * are read and changed as the Workshop does, so a change made on another device shows here too.
 */
export function CharterScreen({ client }: { client: ServiceClient }) {
  const { data: settings, error } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = (change: SettingsChange) => {
    client.request({ _tag: "ChangeSettings", change }).then(
      () => setSaveError(null),
      (reason) => setSaveError(messageOf(reason)),
    );
  };
  return (
    <ScrollView contentContainerStyle={local.content} style={local.page}>
      <SettingsHeading icon="scroll" line="Connectors and what they may do for your quests." title="Charter" />
      {error !== null && <Text style={local.error}>{error}</Text>}
      {saveError !== null && <Text style={local.error}>{saveError}</Text>}
      {settings && (
        <SettingsCard icon="code" title="Connectors">
          <View style={local.switchRow}>
            <ToggleRow
              label={codeModeLabel}
              onChange={(shouldUseCodeMode) => save({ shouldUseCodeMode })}
              value={settings.shouldUseCodeMode}
            />
            <View style={local.tag}>
              <Text style={local.tagText}>{experimentalLabel}</Text>
            </View>
          </View>
          <Text style={styles.body}>{codeModeStateOf(settings.shouldUseCodeMode)}</Text>
          <Text style={local.explanation}>{codeModeExplanation}</Text>
        </SettingsCard>
      )}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  content: { gap: 18, paddingHorizontal: 28, paddingVertical: 20 },
  error: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md },
  explanation: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.base },
  page: { backgroundColor: colors.page, flex: 1 },
  switchRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tag: { backgroundColor: colors.controlActive, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "700" },
});
