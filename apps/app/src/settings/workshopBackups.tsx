import type { BackupCompanion, Tier } from "@outlore/contracts";
import { useState } from "react";
import { Text, View } from "react-native";
import { BackupsEditor } from "../editors/backupsEditor";
import { PresetNameForm } from "../editors/presetNameForm";
import { RunnerPickers, useHarnesses } from "../editors/runners";
import { useOwnBackups } from "../editors/useOwnBackups";
import { messageOf, type ServiceClient } from "../foundation/client";
import { runnerSummaryOf } from "../foundation/formatting";
import { Button } from "../ui/button";
import { Fold, FoldGroup } from "../ui/fold";
import { companionStyles } from "./companionStyles";
import { savePresetEdit } from "./presetActions";
import { workshopDraft } from "./workshopDraft";
import { customFocusOf, type WorkshopFocus, type WorkshopPreset } from "./workshopTabs";

/**
 * A list of backup Companions in the tab: what the list does, then one fold for each.
 * The tab draws it away from the page, so it reads the saved list and saves its own changes at once, as a thread's does; the list is the owner's own once they change it, until the saved one changes elsewhere.
 */
export function WorkshopBackups({
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
    <View style={companionStyles.backups}>
      <Text style={companionStyles.title}>Backup companions</Text>
      <Text style={companionStyles.note}>{note}</Text>
      <BackupsEditor backups={shown} harnesses={harnesses} isCompact={false} isFolded={true} onChange={save} />
      {error !== null && <Text style={companionStyles.error}>{error}</Text>}
    </View>
  );
}

/**
 * A preset not yet made: its Companion and backups are chosen here and kept as a draft, unlike a saved preset's, which
 * save at once. Saving asks for the name, and the tab then shows the new preset.
 */
export function DraftPreset({
  client,
  draft,
  lastPreset,
  onFocus,
}: {
  client: ServiceClient;
  draft: Tier;
  /** Where Discard returns to. */
  lastPreset: WorkshopPreset;
  onFocus: (focus: WorkshopFocus) => void;
}) {
  const { data: harnesses } = useHarnesses(client);
  const setDraft = workshopDraft.set;
  return (
    <View style={companionStyles.tier}>
      <Text style={companionStyles.note}>
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
      <View style={companionStyles.draftActions}>
        <PresetNameForm
          label="Save as new preset"
          onSave={async (name) => {
            await savePresetEdit(client, { _tag: "Add", name, stack: draft });
            onFocus(customFocusOf(name));
          }}
        />
        <Button isPrimary={false} label="Discard" onPress={() => onFocus(lastPreset)} />
      </View>
    </View>
  );
}
