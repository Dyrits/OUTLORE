import type { HarnessList, Settings, SettingsChange, Tier, TierName } from "@outlore/contracts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useHarnesses } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { effortLabel, harnessLabels, modelLabelOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts } from "../foundation/theme";
import { Row } from "../quests/questPanel";
import { CompanionTable } from "./companionTable";
import { AddPreset } from "./presetActions";
import { SettingsCard } from "./settingsParts";
import { tierNameOf, tierNames } from "./tierNames";

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
            <PresetStackRows harnesses={harnesses} stack={tier} />
          )
        }
        runner={tier ?? defaults}
      />
    </View>
  );
}

function PresetStackRows({ harnesses, stack }: { harnesses: HarnessList | null; stack: Tier }) {
  const harness = harnesses?.harnesses.find((candidate) => candidate.name === stack.harness);
  const account = harness?.accounts.find((candidate) => candidate.id === stack.accountId);
  return (
    <>
      <Row
        icon="chip"
        label="Harness"
        mark={stack.harness}
        value={
          account === undefined ? harnessLabels[stack.harness] : `${harnessLabels[stack.harness]} · ${account.label}`
        }
      />
      <Row
        icon="model"
        label="Model"
        value={`${modelLabelOf(stack.model, harness?.models)} · ${effortLabel(stack.effort)}`}
      />
      <Row
        icon="shield"
        label="Backups"
        value={stack.backups.length === 0 ? "None" : countedOf(stack.backups.length, "backup")}
      />
    </>
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
      {settings.companionPresets?.custom.map(({ name, stack }, index) => (
        <View key={name} style={local.tier}>
          <Text style={local.tierName}>{name}</Text>
          <CompanionTable
            client={client}
            focus={`custom:${name}`}
            harnesses={harnesses}
            onChange={() => {}}
            rank={tierNames.length + index + 1}
            rows={<PresetStackRows harnesses={harnesses} stack={stack} />}
            runner={stack}
          />
        </View>
      ))}
      <AddPreset
        startOf={(focus) => {
          const tierStackOf = (key: string) => {
            const tier = tierNameOf(key);
            return tier === null ? null : settings.tiers[tier];
          };
          const shown =
            focus === "Default"
              ? null
              : focus.startsWith("custom:")
                ? settings.companionPresets?.custom.find(({ name }) => `custom:${name}` === focus)?.stack
                : tierStackOf(focus);
          return (
            shown ?? {
              accountId: null,
              backups: [],
              effort: settings.defaultEffort,
              harness: settings.defaultHarness,
              model: settings.defaultModel,
            }
          );
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
