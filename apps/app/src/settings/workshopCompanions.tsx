import type { SettingsChange, Tier } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { messageOf, type ServiceClient } from "../foundation/client";
import { runnerSummaryOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Fold, FoldGroup } from "../ui/fold";
import { companionStyles } from "./companionStyles";
import { Tabs } from "./companionTabs";
import { CustomPresets } from "./customPresets";
import { PresetActions, savePresetEdit } from "./presetActions";
import { tierNameOf, tierNames } from "./tierNames";
import { DraftPreset, WorkshopBackups } from "./workshopBackups";
import { useWorkshopDraft, workshopDraft } from "./workshopDraft";
import { customFocusOf, type WorkshopFocus, type WorkshopPreset } from "./workshopTabs";

/** The Workshop's Companions panel opens on the default stack or the selected preset. */
export function WorkshopCompanions({
  client,
  focus,
  lastPreset,
  onFocus,
}: {
  client: ServiceClient;
  /** What the tab shows; the page's tables and the tab's tabs share it. */
  focus: WorkshopFocus;
  /** The preset the Presets tab opens on. */
  lastPreset: WorkshopPreset;
  onFocus: (focus: WorkshopFocus) => void;
}) {
  const { data: settings } = useServiceQuery(client, { _tag: "ReadSettings" }, "settings");
  const { data: harnesses } = useHarnesses(client);
  const draft = useWorkshopDraft();
  const [error, setError] = useState<string | null>(null);
  const save = (change: SettingsChange) => {
    setError(null);
    client.request({ _tag: "ChangeSettings", change }).catch((reason) => setError(messageOf(reason)));
  };
  if (settings === null) return <Text style={companionStyles.note}>Reading the settings…</Text>;
  const defaults = {
    accountId: null,
    effort: settings.defaultEffort,
    harness: settings.defaultHarness,
    model: settings.defaultModel,
  };
  const custom = settings.companionPresets?.custom ?? [];
  const presets = [
    ...tierNames.map(({ hint, name }) => ({
      focus: name,
      hint: `${hint} Chronicler picks it for work of this weight.`,
      name: settings.companionPresets?.tierNames[name] ?? name,
      save: (stack: Tier) => client.request({ _tag: "ChangeSettings", change: { tiers: { [name]: stack } } }),
      stack: settings.tiers[name],
    })),
    ...custom.map(({ name, stack }) => ({
      focus: customFocusOf(name),
      hint: null,
      name,
      save: (next: typeof stack) => savePresetEdit(client, { _tag: "SetStack", name, stack: next }),
      stack,
    })),
  ];
  const selected = focus === "Default" ? lastPreset : focus;
  const preset = presets.find((candidate) => candidate.focus === selected);
  const isDraft = draft !== null;
  const isPresets = isDraft || (focus !== "Default" && preset !== undefined);
  const stack = preset?.stack ?? null;
  const saveStack = (next: Tier) => {
    setError(null);
    preset?.save(next).catch((reason) => setError(messageOf(reason)));
  };
  return (
    <View style={companionStyles.panel}>
      <Tabs
        onChange={(next) => onFocus(next === "Presets" ? (preset?.focus ?? "Light") : "Default")}
        options={["Default", "Presets"]}
        value={isPresets ? "Presets" : "Default"}
      />
      {isPresets && (
        <>
          <Tabs
            labelOf={(option) => presets.find((candidate) => candidate.focus === option)?.name ?? option}
            onChange={onFocus}
            options={tierNames.map(({ name }) => name)}
            value={isDraft ? null : tierNameOf(selected)}
          />
          <CustomPresets
            harnesses={harnesses}
            isDraft={isDraft}
            onAdd={() => workshopDraft.set(stack ?? { ...defaults, backups: [] })}
            onFocus={onFocus}
            presets={presets.filter((candidate) => candidate.focus.startsWith("custom:"))}
            selected={selected}
          />
        </>
      )}
      {draft !== null ? (
        <DraftPreset client={client} draft={draft} lastPreset={lastPreset} onFocus={onFocus} />
      ) : !isPresets || preset === undefined ? (
        <FoldGroup initial="main" key="default">
          <Fold harness={defaults.harness} id="main" summary={runnerSummaryOf(harnesses, defaults)} title="Companion">
            <RunnerPickers
              client={client}
              harnesses={harnesses}
              isAccountShown={false}
              isCompact={false}
              isPanel={true}
              onChange={(runner) =>
                save({ defaultEffort: runner.effort, defaultHarness: runner.harness, defaultModel: runner.model })
              }
              value={defaults}
            />
          </Fold>
          <WorkshopBackups
            backups={settings.backups}
            client={client}
            note="When a turn fails, as when a usage limit is reached, a quest carries on with the first of these that differs from its own Companion."
            onSave={(backups) => client.request({ _tag: "ChangeSettings", change: { backups } })}
          />
        </FoldGroup>
      ) : (
        <View key={preset.focus} style={companionStyles.tier}>
          {preset.hint !== null && <Text style={companionStyles.note}>{preset.hint}</Text>}
          {stack === null ? (
            <>
              <Text style={companionStyles.note}>Not set: this work starts on the default Companion.</Text>
              <Pressable accessibilityRole="button" onPress={() => saveStack({ ...defaults, backups: [] })}>
                <Text style={styles.link}>Set a Companion</Text>
              </Pressable>
            </>
          ) : (
            <FoldGroup initial="main">
              <Fold harness={stack.harness} id="main" summary={runnerSummaryOf(harnesses, stack)} title="Companion">
                <RunnerPickers
                  client={client}
                  harnesses={harnesses}
                  isCompact={false}
                  isPanel={true}
                  onChange={(runner) => saveStack({ ...runner, backups: stack.backups })}
                  value={stack}
                />
              </Fold>
              <WorkshopBackups
                backups={stack.backups}
                client={client}
                // The folds belong to this preset alone.
                key={preset.focus}
                note={`Work started on ${preset.name} carries on with the first of these when a turn fails. Choosing ${preset.name} for a quest puts them in place with the Companion.`}
                onSave={(backups) => preset.save({ ...stack, backups })}
              />
              <PresetActions client={client} key={preset.name} name={preset.name} />
            </FoldGroup>
          )}
        </View>
      )}
      {error !== null && <Text style={companionStyles.error}>{error}</Text>}
    </View>
  );
}
