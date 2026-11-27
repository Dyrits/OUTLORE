import type { BackupCompanion, Tier } from "@outlore/contracts";
import type { ReactElement } from "react";
import type { CompanionPickerProps } from "../foundation/companionPickerProps";
import { runnerSummaryOf } from "../foundation/formatting";
import { Button } from "../ui/button";
import { Fold } from "../ui/fold";
import { CompanionBody } from "./companionBody";
import { DetailsHeader } from "./presetEditor";
import { customHint, customName, type PresetEntry } from "./presetEntries";
import { PresetNameForm } from "./presetNameForm";
import { PresetOverwrite } from "./presetOverwrite";
import type { Preset } from "./presets";

/**
 * The details of a thread's Companions tab outside edit mode: the thread's own Companion in a fold, what belongs to the thread alone, and the ways to put its stack into a preset (Overwrite a preset it was changed from, or Save as a preset).
 */
export function ThreadCompanionDetails({
  backups,
  chosen,
  entriesCount,
  extra,
  isCustomStack,
  onEdit,
  onOverwritePreset,
  onSavePreset,
  overwritten,
  picker,
  stack,
}: {
  backups: ReadonlyArray<BackupCompanion> | null | undefined;
  /** The list row marked chosen, if any. */
  chosen: PresetEntry | undefined;
  entriesCount: number;
  extra: ReactElement | undefined;
  isCustomStack: boolean;
  onEdit: (name: string) => void;
  onOverwritePreset: ((name: string, stack: Tier) => Promise<unknown>) | undefined;
  onSavePreset: ((name: string, stack: Tier) => Promise<unknown>) | undefined;
  /** The preset the thread's Companion was changed from, which Overwrite replaces. */
  overwritten: Preset | undefined;
  picker: Omit<CompanionPickerProps, "extra" | "panel">;
  stack: Tier | null;
}) {
  return (
    <>
      {entriesCount > 0 && stack !== null && (
        <DetailsHeader
          action={
            chosen?.kind === "preset" && onOverwritePreset !== undefined ? (
              <Button isPrimary={false} label="Edit" onPress={() => onEdit(chosen.preset.name)} />
            ) : null
          }
          title={chosen?.kind === "preset" ? chosen.preset.name : `${customName}, ${customHint}`}
        />
      )}
      <Fold harness={picker.harness} id="main" summary={runnerSummaryOf(picker.harnesses, picker)} title="Companion">
        <CompanionBody {...picker} />
      </Fold>
      {extra}
      {onOverwritePreset !== undefined && stack !== null && isCustomStack && overwritten !== undefined && (
        <PresetOverwrite
          key={overwritten.name}
          name={overwritten.name}
          onOverwrite={() => onOverwritePreset(overwritten.name, stack)}
        />
      )}
      {onSavePreset !== undefined && backups != null && (
        <PresetNameForm
          key={extra?.key}
          label="Save as a preset"
          onSave={(name) =>
            onSavePreset(name, {
              accountId: picker.accountId,
              backups,
              effort: picker.effort,
              harness: picker.harness,
              model: picker.model,
            })
          }
        />
      )}
    </>
  );
}
