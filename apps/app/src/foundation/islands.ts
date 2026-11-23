import { useSyncExternalStore } from "react";
import { colorScheme, theme } from "./colorScheme";
import { canvasOf, type Islands, islandShadowOf, islandsOf } from "./islandsRules";
import { colors } from "./theme";

// The owner's Islands settings, kept in the browser's storage and shown at once with no reload: the Workshop's Look card
// sets them and the window's frame reads them. A platform without storage keeps the defaults.

const storageKey = "outlore:islands";

/** Whether the frame is drawn as islands: the Islands theme, fixed for a run as every theme is. */
export const isIslands = theme === "islands";

const readStored = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(storageKey) ?? null;
  } catch {
    return null;
  }
};

let current: Islands = islandsOf(readStored());
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Keeps one Islands setting and redraws the frame with it. */
export function chooseIslands(change: Partial<Islands>): void {
  current = { ...current, ...change };
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(current));
  } catch {}
  for (const listener of listeners) listener();
}

/** The owner's Islands settings; the component draws again when one is chosen. */
export const useIslands = (): Islands => useSyncExternalStore(subscribe, () => current);

/** How the frame draws its islands now; null in every other theme, which keeps its flat frame. */
export type IslandFrame = {
  readonly gap: number;
  /** The canvas's plain color, for the views behind the islands. */
  readonly canvas: string;
  /** The canvas with its glow, for the page behind the app. */
  readonly background: string;
  /** The style of one island: its panel color, hairline, corners, and shadow. */
  readonly island: {
    readonly backgroundColor: string;
    readonly borderColor: string;
    readonly borderRadius: number;
    readonly borderWidth: number;
    readonly boxShadow: string;
    readonly overflow: "hidden";
  };
};

/** The frame of the Islands theme with the owner's settings, or null in another theme. */
export function useIslandFrame(): IslandFrame | null {
  const islands = useIslands();
  if (!isIslands) return null;
  const { background, color } = canvasOf(islands.canvas, colorScheme);
  return {
    background,
    canvas: color,
    gap: islands.gap,
    island: {
      backgroundColor: colors.page,
      borderColor: colors.edge,
      borderRadius: islands.radius,
      borderWidth: 1,
      boxShadow: islandShadowOf(islands.lift, colorScheme),
      overflow: "hidden",
    },
  };
}
