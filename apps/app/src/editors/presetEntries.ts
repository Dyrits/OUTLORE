import type { BackupCompanion, Tier } from "@outlore/contracts";
import { type Preset, presetOf } from "./presets";
import type { Runner } from "./runner";

/** One card of the companion list: a saved preset, marked when the thread has its whole stack. */
export type PresetEntry = {
  readonly id?: string;
  readonly isChosen: boolean;
  readonly preset: Preset;
};

/**
 * The cards of the companion list for the thread's whole stack (null while its backups are unread): each saved preset,
 * with the matching one marked chosen. No presets, no cards; an unread stack marks nothing.
 */
export const entriesOf = (presets: ReadonlyArray<Preset>, stack: Tier | null): ReadonlyArray<PresetEntry> => {
  if (presets.length === 0) return [];
  const chosen = presetOf(presets, stack);
  return presets.map((preset) => ({
    isChosen: preset.name === chosen?.name,
    preset,
  }));
};

/** The gap between the list column and the editor column in the split layout. */
export const splitGap = 16;

/** The panel's own least width for the list and editor to sit side by side; narrower, they stack. */
export const splitLeastWidth = 480;

/** How the Companions tab lays out its list and editor at a measured width; before it is measured, stacked. */
export const panelLayoutOf = (width: number | null): "split" | "stacked" =>
  width !== null && width >= splitLeastWidth ? "split" : "stacked";

/** A stack with another primary Companion and the same backups. */
export const withRunner = (stack: Tier, runner: Runner): Tier => ({ ...runner, backups: stack.backups });

/** A stack with other backups and the same primary Companion. */
export const withBackups = (stack: Tier, backups: ReadonlyArray<BackupCompanion>): Tier => ({ ...stack, backups });
