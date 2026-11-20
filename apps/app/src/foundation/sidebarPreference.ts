import { useSyncExternalStore } from "react";
import {
  type SidebarMode,
  type SidebarSide,
  sidebarModeOf,
  sidebarPinnedOf,
  sidebarSideOf,
} from "./sidebarPreferenceRules";

// The owner's choice of the sidebar's mode and side, kept in the browser's storage. It lives here, below the shell,
// because the Workshop's Look card sets it and the window's frame reads it; a platform without storage keeps the
// defaults and loses only the memory.

const modeKey = "outlore:sidebar-mode";
const sideKey = "outlore:sidebar-side";
const pinnedKey = "outlore:sidebar-pinned";

/** What the browser kept under a key; null with nothing kept, no browser storage, or storage that refuses to answer. */
const readStored = (key: string): string | null => {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const keep = (key: string, text: string) => {
  try {
    globalThis.localStorage?.setItem(key, text);
  } catch {}
};

type Preference = { readonly isPinned: boolean; readonly mode: SidebarMode; readonly side: SidebarSide };

let current: Preference = {
  isPinned: sidebarPinnedOf(readStored(pinnedKey)),
  mode: sidebarModeOf(readStored(modeKey)),
  side: sidebarSideOf(readStored(sideKey)),
};
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const change = (next: Preference) => {
  current = next;
  for (const listener of listeners) listener();
};

/** Keeps the sidebar's mode and shows it at once, with no reload. */
export const chooseSidebarMode = (mode: SidebarMode) => {
  keep(modeKey, mode);
  change({ ...current, mode });
};

/** Keeps the sidebar's side and shows it at once, with no reload. */
export const chooseSidebarSide = (side: SidebarSide) => {
  keep(sideKey, side);
  change({ ...current, side });
};

/** Keeps whether the overlay sidebar is pinned open and shows it at once. */
export const chooseSidebarPinned = (isPinned: boolean) => {
  keep(pinnedKey, String(isPinned));
  change({ ...current, isPinned });
};

/** The owner's sidebar mode, side and pin; the component draws again when any is chosen. */
export const useSidebarPreference = (): Preference => useSyncExternalStore(subscribe, () => current);
