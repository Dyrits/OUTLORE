import type { BackupCompanion, SettingsChange, Tier, TierName } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BackupsEditor } from "../editors/backupsEditor";
import { PresetNameForm } from "../editors/presetNameForm";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { useOwnBackups } from "../editors/useOwnBackups";
import { messageOf, type ServiceClient } from "../foundation/client";
import { runnerSummaryOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { Button } from "../ui/button";
import { Fold, FoldGroup } from "../ui/fold";
import { PresetActions, savePresetEdit } from "./presetActions";
import { useWorkshopDraft, workshopDraft } from "./workshopDraft";
import type { WorkshopFocus, WorkshopPreset } from "./workshopTabs";

/** The three presets, as the Companions tab and the page name them. */
export const tierNames: ReadonlyArray<{ hint: string; name: TierName }> = [
  { hint: "Small, well-scoped, checkable work: renames, small fixes.", name: "Light" },
  { hint: "Ordinary implementation, debugging, and tests.", name: "Balanced" },
  { hint: "Ambiguous, architectural, or risky work.", name: "Heavy" },
];

/** A row of tabs in the Companions tab's own style. */
function Tabs<T extends string>({
  onChange,
  shouldWrap = false,
  options,
  value,
  labelOf,
}: {
  onChange: (option: T) => void;
  options: ReadonlyArray<T>;
  shouldWrap?: boolean;
  value: T;
  labelOf?: (option: T) => string;
}) {
  return (
    <View accessibilityRole="tablist" style={[local.tabs, shouldWrap && local.wrappedTabs]}>
      {options.map((option) => (
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: option === value }}
          key={option}
          onPress={() => onChange(option)}
          style={[local.tab, shouldWrap && local.wrappedTab, option === value && local.tabActive]}
        >
          <Text style={[local.tabText, option === value && local.tabTextActive]}>{labelOf?.(option) ?? option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * A list of backup Companions in the tab: what the list does, then one fold for each.
 * The tab draws it away from the page, so it reads the saved list and saves its own changes at once, as a thread's does; the list is the owner's own once they change it, until the saved one changes elsewhere.
 */
function WorkshopBackups({
  backups,
  client,
  note,
  onSave,
}: {
  backups: ReadonlyArray<BackupCompanion>;
  client: ServiceClient;
  note: string;
  onSave: (backups: ReadonlyArray<BackupCompanion>) => Promise<unknown>;
}) {
  const { data: harnesses } = useHarnesses(client);
  const { backups: shown, discard, edit } = useOwnBackups(backups);
  const [error, setError] = useState<string | null>(null);
  const save = (next: ReadonlyArray<BackupCompanion>) => {
    edit(next);
    setError(null);
    onSave(next).catch((reason) => {
      discard();
      setError(messageOf(reason));
    });
  };
  return (
    <View style={local.backups}>
      <Text style={local.title}>Backup companions</Text>
      <Text style={local.note}>{note}</Text>
      <BackupsEditor backups={shown} harnesses={harnesses} isCompact={false} isFolded={true} onChange={save} />
      {error !== null && <Text style={local.error}>{error}</Text>}
    </View>
  );
}

/**
 * A preset not yet made: its Companion and backups are chosen here and kept as a draft, unlike a saved preset's, which
 * save at once. Saving asks for the name, and the tab then shows the new preset.
 */
function DraftPreset({
  client,
  draft,
  onFocus,
}: {
  client: ServiceClient;
  draft: Tier;
  onFocus: (focus: WorkshopFocus) => void;
}) {
  const { data: harnesses } = useHarnesses(client);
  const setDraft = workshopDraft.set;
  return (
    <View style={local.tier}>
      <Text style={local.note}>
        New preset, not saved yet. Choose its Companion and backups, then save it under a name.
      </Text>
      <FoldGroup initial="main">
        <Fold harness={draft.harness} id="main" summary={runnerSummaryOf(harnesses, draft)} title="Companion">
          <RunnerPickers
            client={client}
            harnesses={harnesses}
            isCompact={false}
            isPanel={true}
            onChange={(runner) => setDraft({ ...runner, backups: draft.backups })}
            value={draft}
          />
        </Fold>
        <WorkshopBackups
          backups={draft.backups}
          client={client}
          note="When a turn fails, a quest using this preset carries on with the first of these."
          onSave={async (backups) => setDraft({ ...draft, backups })}
        />
      </FoldGroup>
      <View style={local.draftActions}>
        <PresetNameForm
          label="Save as new preset"
          onSave={async (name) => {
            await savePresetEdit(client, { _tag: "Add", name, stack: draft });
            onFocus(`custom:${name}`);
          }}
        />
        <Button isPrimary={false} label="Discard" onPress={() => workshopDraft.set(null)} />
      </View>
    </View>
  );
}

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
  if (settings === null) return <Text style={local.note}>Reading the settings…</Text>;
  if (draft !== null) return <DraftPreset client={client} draft={draft} onFocus={onFocus} />;
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
      focus: `custom:${name}` as const,
      hint: null,
      name,
      save: (next: typeof stack) => savePresetEdit(client, { _tag: "SetStack", name, stack: next }),
      stack,
    })),
  ];
  const selected = focus === "Default" ? lastPreset : focus;
  const preset = presets.find((candidate) => candidate.focus === selected);
  const isPresets = focus !== "Default" && preset !== undefined;
  const stack = preset?.stack ?? null;
  const saveStack = (next: Tier) => {
    setError(null);
    preset?.save(next).catch((reason) => setError(messageOf(reason)));
  };
  return (
    <View style={local.panel}>
      <Tabs
        onChange={(next) => onFocus(next === "Presets" ? (preset?.focus ?? "Light") : "Default")}
        options={["Default", "Presets"]}
        value={isPresets ? "Presets" : "Default"}
      />
      {isPresets && (
        <Tabs
          labelOf={(option) => presets.find((candidate) => candidate.focus === option)?.name ?? option}
          onChange={onFocus}
          options={presets.map((candidate) => candidate.focus)}
          shouldWrap={custom.length > 0}
          value={selected}
        />
      )}
      {!isPresets || preset === undefined ? (
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
        <View key={preset.focus} style={local.tier}>
          {preset.hint !== null && <Text style={local.note}>{preset.hint}</Text>}
          {stack === null ? (
            <>
              <Text style={local.note}>Not set: this work starts on the default Companion.</Text>
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
      {error !== null && <Text style={local.error}>{error}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  backups: { gap: 8, paddingTop: 8 },
  draftActions: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  // The column's tabs sit 20 px above the first row (its own 12 px of padding, shortened to 6 for this panel) and the rows 8 px apart; every gap is 14 px.
  panel: { gap: 14 },
  tab: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 5,
  },
  tabActive: { backgroundColor: colors.controlActive },
  tabs: { flexDirection: "row", gap: 6 },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: colors.accentText, fontWeight: "700" },
  tier: { gap: 8 },
  title: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
  wrappedTab: { flex: 0, flexGrow: 1, maxWidth: "100%", paddingHorizontal: 8 },
  wrappedTabs: { flexWrap: "wrap" },
});
