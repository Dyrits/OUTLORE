import type { Settings, SettingsChange, Tier, TierName } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useHarnesses } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf, runnerSummaryOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Row } from "../quests/questPanel";
import { CompanionTable } from "./companionTable";
import { AddPreset, EditPreset, PresetActions } from "./presetActions";
import { SettingsCard } from "./settingsParts";
import { tierNames } from "./workshopCompanions";

/**
 * One preset: its name and what it is for, a Set or Clear beside them, and its Companion as the same table as the
 * default's, or the words that it is not set. Setting one starts from the default Companion; clearing it returns the
 * work to the default.
 */
function PresetRow({
  client,
  hint,
  name,
  onChange,
  rank,
  settings,
  tier,
}: {
  client: ServiceClient;
  hint: string;
  name: TierName;
  onChange: (tier: Tier | null) => void;
  rank: number;
  settings: Settings;
  tier: Tier | null;
}) {
  const { data: harnesses } = useHarnesses(client);
  const defaults = {
    accountId: null,
    backups: [],
    effort: settings.defaultEffort,
    harness: settings.defaultHarness,
    model: settings.defaultModel,
  };
  const displayName = settings.companionPresets?.tierNames[name] ?? name;
  const models = harnesses?.harnesses.find((candidate) => candidate.name === tier?.harness)?.models;
  const account = harnesses?.harnesses
    .find((candidate) => candidate.name === tier?.harness)
    ?.accounts.find((candidate) => candidate.id === tier?.accountId);
  return (
    <View style={local.tier}>
      <View style={local.tierHead}>
        <View style={styles.flex}>
          <Text style={local.tierName}>{displayName}</Text>
          <Text style={styles.muted}>{displayName === name ? hint : `${name} tier · ${hint}`}</Text>
        </View>
        {tier === null && (
          <Pressable accessibilityRole="button" onPress={() => onChange(defaults)}>
            <Text style={styles.link}>Set a Companion</Text>
          </Pressable>
        )}
      </View>
      <CompanionTable
        client={client}
        focus={name}
        harnesses={harnesses}
        onChange={(runner) => onChange({ ...runner, backups: tier?.backups ?? [] })}
        rank={rank}
        rows={
          tier === null ? (
            <Row icon="chip" label="Not set" value="Work of this weight starts on the default Companion" />
          ) : (
            <>
              <Row
                icon="chip"
                label="Harness"
                mark={tier.harness}
                value={
                  account === undefined || tier.accountId === null
                    ? harnessLabels[tier.harness]
                    : `${harnessLabels[tier.harness]} · ${account.label}`
                }
              />
              <Row
                icon="model"
                label="Model"
                value={`${modelLabelOf(tier.model, models)} · ${effortLabel(tier.effort)}`}
              />
              <Row
                icon="shield"
                label="Backups"
                value={tier.backups.length === 0 ? "None" : countedOf(tier.backups.length, "backup")}
              />
            </>
          )
        }
        runner={tier ?? defaults}
      />
      {tier !== null && <PresetActions client={client} key={displayName} name={displayName} />}
    </View>
  );
}

/** The Workshop library of routing tiers and custom presets. */
export function PresetsCard({
  client,
  onSave,
  settings,
}: {
  client: ServiceClient;
  onSave: (change: SettingsChange) => void;
  settings: Settings;
}) {
  const { data: harnesses } = useHarnesses(client);
  return (
    <SettingsCard icon="layers" summary="Saved Companions and their backups" title="Presets">
      {tierNames.map(({ hint, name }, index) => (
        <PresetRow
          client={client}
          hint={hint}
          key={name}
          name={name}
          onChange={(next) => onSave({ tiers: { [name]: next } })}
          rank={index + 1}
          settings={settings}
          tier={settings.tiers[name]}
        />
      ))}
      {settings.companionPresets?.custom.map(({ name, stack }) => (
        <View key={name} style={local.tier}>
          <Text style={local.tierName}>{name}</Text>
          <Text style={styles.muted}>
            {runnerSummaryOf(harnesses, stack)} · {countedOf(stack.backups.length, "backup")}
          </Text>
          <PresetActions client={client} name={name} />
          <EditPreset client={client} name={name} saved={stack} />
        </View>
      ))}
      <AddPreset
        client={client}
        defaults={{
          accountId: null,
          backups: [],
          effort: settings.defaultEffort,
          harness: settings.defaultHarness,
          model: settings.defaultModel,
        }}
      />
    </SettingsCard>
  );
}

const local = StyleSheet.create({
  tier: { gap: 8, paddingVertical: 6 },
  tierHead: { alignItems: "center", flexDirection: "row", gap: 12 },
  tierName: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
});
