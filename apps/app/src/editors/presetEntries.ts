import type { BackupCompanion, Tier } from "@outlore/contracts";
import { type Preset, presetOf } from "./presets";
import type { Runner } from "./runner";

/** The word of the entry for a stack no preset holds, and what it says under it. */
export const customName = "Custom";
export const customHint = "not saved yet";

/** One row of the preset list: a preset, marked when the thread has its whole stack, or the Custom entry, which is always the chosen one. */
export type PresetEntry =
  | { readonly isChosen: boolean; readonly kind: "preset"; readonly preset: Preset }
  | { readonly isChosen: true; readonly kind: "custom" };

/**
 * The rows of the preset list for the thread's whole stack (null while its backups are unread): each preset, then
 * Custom when the stack matches none of them. No presets, no rows; an unread stack marks nothing and shows no Custom.
 */
export const entriesOf = (presets: ReadonlyArray<Preset>, stack: Tier | null): ReadonlyArray<PresetEntry> => {
  if (presets.length === 0) return [];
  const chosen = presetOf(presets, stack);
  const rows: ReadonlyArray<PresetEntry> = presets.map((preset) => ({
    isChosen: preset.name === chosen?.name,
    kind: "preset",
    preset,
  }));
  return stack !== null && chosen === null ? [...rows, { isChosen: true, kind: "custom" }] : rows;
};

/** The width of the list in the split layout, and the gap between it and the details. */
export const navWidth = 176;
export const splitGap = 12;

/**
 * The panel's own least width for the presets to stand in a list beside the thread's Companion details: the list at 176, the gap of 12, the details at 268 (the mini panel's 288 less its padding is 264) and the panel's padding of 12 on each side.
 * The details column is 360 wide at first and is resized up to a quarter of the window, so this is reached from a window of 1,920 pixels, or in any panel wider than that column.
 */
export const splitLeastWidth = 480;

/** How the Companions tab lays out its presets and details at a measured width; before it is measured, stacked. */
export const panelLayoutOf = (width: number | null): "split" | "stacked" =>
  width !== null && width >= splitLeastWidth ? "split" : "stacked";

/** What the details of the tab show: the preset being edited, if it still exists, or else the thread's own Companion. */
export const detailsModeOf = (
  presets: ReadonlyArray<Preset>,
  editing: string | null,
): { readonly mode: "edit"; readonly preset: Preset } | { readonly mode: "thread" } => {
  const preset = editing === null ? undefined : presets.find((candidate) => candidate.name === editing);
  return preset === undefined ? { mode: "thread" } : { mode: "edit", preset };
};

/** A stack with another primary Companion and the same backups. */
export const withRunner = (stack: Tier, runner: Runner): Tier => ({ ...runner, backups: stack.backups });

/** A stack with other backups and the same primary Companion. */
export const withBackups = (stack: Tier, backups: ReadonlyArray<BackupCompanion>): Tier => ({ ...stack, backups });
