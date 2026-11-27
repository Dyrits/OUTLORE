import type { Tier } from "@outlore/contracts";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PresetChainEditor } from "../editors/presetChainEditor";
import { PresetChooser } from "../editors/presetChooser";
import { type PresetEntry, panelLayoutOf } from "../editors/presetEntries";
import { useHarnesses } from "../editors/runners";
import { keptRenamed, keptWith, keptWithout, liveDraftsOf, ownValue } from "../editors/useDraftStack";
import { messageOf, type ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { companionStyles } from "./companionStyles";
import { DraftPreset } from "./draftPreset";
import { PresetActions, savePresetEdit } from "./presetActions";
import { tierNames } from "./tierNames";
import {
  draftSeedOf,
  renamedFocusOf,
  useWorkshopDraft,
  useWorkshopKept,
  useWorkshopSaving,
  workshopDraft,
  workshopKept,
  workshopSaving,
} from "./workshopDraft";
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
  const [width, setWidth] = useState<number | null>(null);
  // Each Companion's unsaved chain, kept while another is shown and listed at once.
  const kept = useWorkshopKept();
  const saving = useWorkshopSaving();
  const setKept = workshopKept.set;
  const focusRef = useRef(focus);
  focusRef.current = focus;
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
  const defaultStack = { ...defaults, backups: settings.backups };
  const drafts = liveDraftsOf(kept, (key) =>
    key === "Default" ? defaultStack : (presets.find((candidate) => candidate.focus === key)?.stack ?? null),
  );
  const selected = focus;
  const preset = presets.find((candidate) => candidate.focus === selected);
  const isDraft = draft !== null;
  const stack = preset?.stack ?? null;
  const saveStack = (next: Tier) => {
    setError(null);
    preset?.save(next).catch((reason) => setError(messageOf(reason)));
  };
  const isSplit = panelLayoutOf(width) === "split";
  const rows = [{ focus: "Default" as WorkshopFocus, hint: null, name: "Default", stack: defaultStack }, ...presets];
  const entries: ReadonlyArray<PresetEntry> = rows.map((row) => ({
    id: row.focus,
    isChosen: !isDraft && row.focus === selected,
    kind: "preset",
    preset: { backups: row.stack?.backups ?? [], name: row.name, runner: row.stack ?? defaults },
  }));
  const notes = Object.fromEntries(
    rows.filter((row) => row.stack === null).map((row) => [row.focus, "Not set: starts on the default Companion"]),
  );
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[companionStyles.panel, isSplit && companionStyles.split]}
    >
      <View style={isSplit ? companionStyles.nav : companionStyles.navStacked}>
        <PresetChooser
          drafts={drafts}
          entries={entries}
          harnesses={harnesses}
          isChainListed={true}
          isNav={isSplit}
          notes={notes}
          onPreset={(_chosen, id) => {
            const row = rows.find((candidate) => candidate.focus === id);
            if (row !== undefined) onFocus(row.focus);
          }}
        />
        {isDraft ? (
          <View style={[companionStyles.customRow, companionStyles.tabActive]}>
            <Text style={[companionStyles.customName, companionStyles.tabTextActive]}>New preset</Text>
            <Text style={companionStyles.customSummary}>Not saved yet</Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => workshopDraft.set(draftSeedOf({ defaultStack, defaults, drafts, selected, stack }))}
            style={companionStyles.customRow}
          >
            <Text style={styles.link}>+ Add preset</Text>
          </Pressable>
        )}
      </View>
      <View style={companionStyles.details}>
        {draft !== null ? (
          <DraftPreset client={client} draft={draft} lastPreset={lastPreset} onFocus={onFocus} />
        ) : selected === "Default" || preset === undefined ? (
          <View key="default" style={companionStyles.tier}>
            <Text style={companionStyles.note}>
              The Companion a quest starts on when no preset applies, then the backups it carries on with when a turn
              fails, as when a usage limit is reached.
            </Text>
            <PresetChainEditor
              client={client}
              harnesses={harnesses}
              initial={ownValue(drafts, "Default")}
              isPrimaryAccountShown={false}
              isSaving={(ownValue(saving, "Default") ?? 0) > 0}
              name="Default"
              onDraft={(next) => setKept((current) => keptWith(current, "Default", defaultStack, next))}
              onSave={(next) =>
                workshopSaving.track("Default", () =>
                  client.request({
                    _tag: "ChangeSettings",
                    change: {
                      backups: next.backups,
                      defaultEffort: next.effort,
                      defaultHarness: next.harness,
                      defaultModel: next.model,
                    },
                  }),
                )
              }
              stack={defaultStack}
            />
          </View>
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
              <>
                <Text style={companionStyles.note}>
                  {`Work started on ${preset.name} carries on with the first backup when a turn fails. Choosing ${preset.name} for a quest puts the whole chain in place.`}
                </Text>
                <PresetChainEditor
                  client={client}
                  harnesses={harnesses}
                  initial={ownValue(drafts, preset.focus)}
                  isSaving={(ownValue(saving, preset.focus) ?? 0) > 0}
                  name={preset.name}
                  onDraft={(next) => setKept((current) => keptWith(current, preset.focus, stack, next))}
                  onSave={(next) => workshopSaving.track(preset.focus, () => preset.save(next))}
                  onSaveAs={async (name, next) => {
                    await workshopSaving.track(preset.focus, () =>
                      savePresetEdit(client, { _tag: "Add", name, stack: next }),
                    );
                    if (focusRef.current === preset.focus && workshopDraft.get() === null) onFocus(customFocusOf(name));
                  }}
                  stack={stack}
                />
                <PresetActions
                  client={client}
                  key={preset.name}
                  name={preset.name}
                  onDeleted={() => setKept((current) => keptWithout(current, preset.focus))}
                  onRenamed={(nextName) => {
                    const nextFocus = renamedFocusOf(preset.focus, nextName);
                    if (nextFocus !== preset.focus) {
                      setKept((current) => keptRenamed(current, preset.focus, nextFocus));
                      workshopSaving.rename(preset.focus, nextFocus);
                    }
                    if (focusRef.current === preset.focus && workshopDraft.get() === null) onFocus(nextFocus);
                  }}
                />
              </>
            )}
          </View>
        )}
        {error !== null && <Text style={companionStyles.error}>{error}</Text>}
      </View>
    </View>
  );
}
