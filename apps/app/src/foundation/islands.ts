import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import { colorScheme } from "./colorScheme";
import { canvasOf, type Islands, islandShadowOf, islandsOf, shadedByIslandsOf } from "./islandsRules";
import { colors } from "./theme";

// The owner's layout and Islands settings, kept in the browser's storage and shown at once with no reload: the Workshop's
// Look card sets them and the window's frame reads them. A platform without storage keeps the defaults.

// The key CHG-0668 chose for the Islands theme's settings; it stays so those settings survive as the layout's.
const storageKey = "outlore:islands";

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

/** Keeps one layout or Islands setting and redraws the frame with it. */
export function chooseIslands(change: Partial<Islands>): void {
  current = { ...current, ...change };
  try {
    globalThis.localStorage?.setItem(storageKey, JSON.stringify(current));
  } catch {}
  for (const listener of listeners) listener();
}

/** The owner's layout and Islands settings; the component draws again when one is chosen. */
export const useIslands = (): Islands => useSyncExternalStore(subscribe, () => current);

/** How the frame draws its islands now; null when the layout is flat, which draws the frame as it always was. */
export type IslandFrame = {
  readonly gap: number;
  /** The canvas's plain color, for the views behind the islands. */
  readonly canvas: string;
  /** The canvas with its glow, for the page behind the app. */
  readonly background: string;
  /** The style of one island: its panel color, hairline, corners, and shadow. */
  readonly island: IslandStyle;
  /**
   * What the canvas looks like in the gap between islands, shadows and glow included, as the background of a notch
   * with `neighbours` islands beside it (two where it straddles the gap, one on a pane's outer edge).
   */
  readonly gapOf: (neighbours: number) => GapBackground;
};

/**
 * A background drawn as the page behind the app draws its own: the same image, fixed to the window so it lines up
 * with it wherever the view stands.
 */
export type GapBackground = {
  readonly backgroundAttachment: "fixed";
  readonly backgroundColor: string;
  readonly backgroundImage: string;
};

type IslandStyle = {
  readonly backgroundColor: string;
  readonly borderColor: string;
  readonly borderRadius: number;
  readonly borderWidth: number;
  readonly boxShadow: string;
  readonly overflow: "hidden";
};

/**
 * The frame of the Islands layout with the owner's settings and the theme's colors, or null in the flat layout. Only
 * the web build draws islands: the Android app keeps the flat frame, as does any window too narrow for a sidebar (the
 * frame decides that).
 */
export function useIslandFrame(): IslandFrame | null {
  const islands = useIslands();
  if (islands.layout !== "islands" || Platform.OS !== "web") return null;
  const { background, color } = canvasOf(islands.canvas, colors, colorScheme);
  const island: IslandStyle = {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: islands.radius,
    borderWidth: 1,
    boxShadow: islandShadowOf(islands.lift, colorScheme, colors.text),
    overflow: "hidden",
  };
  const gapOf = (neighbours: number): GapBackground => {
    const shaded = canvasOf(islands.canvas, colors, colorScheme, (plain) =>
      shadedByIslandsOf(plain, {
        gap: islands.gap,
        ink: colors.text,
        lift: islands.lift,
        neighbours,
        scheme: colorScheme,
      }),
    );
    return { backgroundAttachment: "fixed", backgroundColor: shaded.color, backgroundImage: shaded.background };
  };
  return {
    background,
    canvas: color,
    gap: islands.gap,
    gapOf,
    island,
  };
}
