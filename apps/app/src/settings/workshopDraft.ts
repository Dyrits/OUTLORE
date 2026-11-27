import type { Tier } from "@outlore/contracts";
import { useSyncExternalStore } from "react";
import type { Runner } from "../editors/runner";
import { type KeptDrafts, ownValue } from "../editors/useDraftStack";
import type { WorkshopFocus } from "./workshopTabs";

/**
 * The preset being made in the Workshop, not yet saved under a name.
 * The Companions tab draws it from the shell, outside the Workshop page's own providers, and the shell only draws the
 * tab again when its key changes, so the draft lives here and the tab subscribes to it.
 */
let draft: Tier | null = null;
const listeners = new Set<() => void>();

export const workshopDraft = {
  get: () => draft,
  set: (next: Tier | null) => {
    draft = next;
    for (const listener of listeners) listener();
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** The draft preset, or null when none is being made. */
export const useWorkshopDraft = () => useSyncExternalStore(workshopDraft.subscribe, workshopDraft.get);

/**
 * The unsaved chain of each Companion, by preset, kept while another Companion is shown. It lives here for the same
 * reason as the draft: the tab is drawn outside the page's providers and again for each Companion it shows.
 */
let kept: KeptDrafts = {};
const keptListeners = new Set<() => void>();

export const workshopKept = {
  get: () => kept,
  set: (change: (current: KeptDrafts) => KeptDrafts) => {
    kept = change(kept);
    for (const listener of keptListeners) listener();
  },
  subscribe: (listener: () => void) => {
    keptListeners.add(listener);
    return () => {
      keptListeners.delete(listener);
    };
  },
};

/** The kept unsaved chains. */
export const useWorkshopKept = () => useSyncExternalStore(workshopKept.subscribe, workshopKept.get);

/** Active save counts by Workshop focus key, so switching presets or renaming keeps the editor locked until an in-flight save settles. */
type ActiveSave = { key: string };
const activeSaves = new Set<ActiveSave>();
let savingCounts: Readonly<Record<string, number>> = {};
const savingListeners = new Set<() => void>();

const publishSavingCounts = () => {
  const next: Record<string, number> = {};
  for (const entry of activeSaves) next[entry.key] = (ownValue(next, entry.key) ?? 0) + 1;
  savingCounts = next;
  for (const listener of savingListeners) listener();
};

export const workshopSaving = {
  get: () => savingCounts,
  isSaving: (key: string) => (ownValue(savingCounts, key) ?? 0) > 0,
  rename: (from: string, to: string) => {
    if (from === to) return;
    let hasMoved = false;
    for (const entry of activeSaves) {
      if (entry.key !== from) continue;
      entry.key = to;
      hasMoved = true;
    }
    if (hasMoved) publishSavingCounts();
  },
  subscribe: (listener: () => void) => {
    savingListeners.add(listener);
    return () => {
      savingListeners.delete(listener);
    };
  },
  track: async <Result>(key: string, action: () => Promise<Result>): Promise<Result> => {
    const entry: ActiveSave = { key };
    activeSaves.add(entry);
    publishSavingCounts();
    try {
      return await action();
    } finally {
      activeSaves.delete(entry);
      publishSavingCounts();
    }
  },
};

/** The Workshop focus keys with a save currently in flight. */
export const useWorkshopSaving = () => useSyncExternalStore(workshopSaving.subscribe, workshopSaving.get);

/** The Workshop focus after renaming `focus` to `nextName`: built-in tiers keep their tier key, while custom presets move to the new name. */
export const renamedFocusOf = (focus: WorkshopFocus, nextName: string): WorkshopFocus =>
  focus.startsWith("custom:") ? `custom:${nextName}` : focus;

/** The chain a new Workshop preset draft starts from: the selected live draft, else the selected saved chain (including Default's backups), else the defaults with no backups. */
export const draftSeedOf = ({
  defaults,
  defaultStack,
  drafts,
  selected,
  stack,
}: {
  defaults: Runner;
  defaultStack: Tier;
  drafts: Readonly<Record<string, Tier>>;
  selected: WorkshopFocus;
  stack: Tier | null;
}): Tier =>
  ownValue(drafts, selected) ?? (selected === "Default" ? defaultStack : stack) ?? { ...defaults, backups: [] };
