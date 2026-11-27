import type { Tier } from "@outlore/contracts";
import { useSyncExternalStore } from "react";
import type { KeptDrafts } from "../editors/useDraftStack";

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
