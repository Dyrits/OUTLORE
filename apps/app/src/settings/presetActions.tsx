import type { CompanionPresetEdit, Tier } from "@outlore/contracts";
import { PresetManagement } from "../editors/presetManagement";
import type { ServiceClient } from "../foundation/client";
import { Button } from "../ui/button";
import { useWorkshopTabs, type WorkshopFocus } from "./workshopTabs";

/** Sends one preset edit without replacing the rest of the library. */
export const savePresetEdit = (client: ServiceClient, edit: CompanionPresetEdit) =>
  client.request({ _tag: "ChangeCompanionPreset", edit });

/** Rename or delete a saved preset from the Workshop. */
export function PresetActions({
  client,
  name,
  onDeleted,
  onRenamed,
}: {
  client: ServiceClient;
  name: string;
  /** Runs once the preset is deleted, so what was kept for it can go. */
  onDeleted?: () => void;
  /** Runs once the preset is renamed, so what was kept for it follows. */
  onRenamed?: (nextName: string) => void;
}) {
  return (
    <PresetManagement
      name={name}
      onDelete={async () => {
        await savePresetEdit(client, { _tag: "Delete", name });
        onDeleted?.();
      }}
      onRename={async (nextName) => {
        await savePresetEdit(client, { _tag: "Rename", name, nextName });
        onRenamed?.(nextName);
      }}
    />
  );
}

/**
 * Starts a new custom preset as a draft in the Companions tab, from the Companion the tab shows now (`startOf`).
 * It takes a name only when it is saved there.
 */
export function AddPreset({ startOf }: { startOf: (focus: WorkshopFocus) => Tier }) {
  const { focus, startDraft } = useWorkshopTabs();
  return <Button isPrimary={false} label="Add preset" onPress={() => startDraft(startOf(focus), focus)} />;
}
