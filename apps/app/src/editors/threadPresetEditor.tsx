import type { HarnessList, Tier } from "@outlore/contracts";
import type { PresetChoice } from "../foundation/companionPickerProps";
import { PresetEditor } from "./presetEditor";
import { type Preset, presetChangeOf } from "./presets";

/**
 * Edit mode of a thread's Companions tab for one preset: the shared editor with what the thread's surface can do to a preset (overwrite, save as new, rename, delete).
 * Saving as new or renaming moves the edit to the preset it made; deleting ends it.
 */
export function ThreadPresetEditor({
  choice,
  harnesses,
  initial,
  onDraft,
  onEditing,
  onOverwrite,
  preset,
}: {
  choice: PresetChoice;
  harnesses: HarnessList | null;
  /** The draft kept from an earlier visit to this preset. */
  initial: Tier | null;
  onDraft: (stack: Tier | null) => void;
  /** Which preset is in edit mode: another name after Save as new or Rename, none after Delete or Done. */
  onEditing: (name: string | null) => void;
  /** Replaces the saved preset with the whole draft. */
  onOverwrite: (name: string, stack: Tier) => Promise<unknown>;
  preset: Preset;
}) {
  const { onDeletePreset, onRenamePreset, onSavePreset } = choice;
  return (
    <PresetEditor
      harnesses={harnesses}
      initial={initial}
      name={preset.name}
      // Done leaves the draft kept: the list still marks it unsaved and editing the preset again resumes it.
      onDone={() => onEditing(null)}
      onDraft={onDraft}
      onSave={(next) => onOverwrite(preset.name, next)}
      stack={presetChangeOf(preset)}
      {...(onRenamePreset === undefined || onDeletePreset === undefined
        ? {}
        : {
            management: {
              onDelete: async () => {
                await onDeletePreset(preset.name);
                onEditing(null);
              },
              onRename: async (nextName: string) => {
                await onRenamePreset(preset.name, nextName);
                onEditing(nextName);
              },
            },
          })}
      {...(onSavePreset === undefined
        ? {}
        : {
            onSaveAs: async (name: string, next: Tier) => {
              await onSavePreset(name, next);
              onEditing(name);
            },
          })}
    />
  );
}
