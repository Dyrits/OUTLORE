import type { ColorScheme } from "./colorSchemeRules";

// The Islands theme's frame: the sidebar, the content, and the quest panel float as rounded panels on a canvas. The
// owner tunes the canvas, the gap between the panels, their corner radius, and how high they lift.

/** The canvas under the islands: a cool or a warm glow, or plain. */
export const islandCanvases = ["cool", "warm", "flat"] as const;
export type IslandCanvas = (typeof islandCanvases)[number];

/** The gaps the owner can choose, in points. */
export const islandGaps = [4, 6, 8, 10, 14, 20] as const;
/** The corner radii the owner can choose, in points. */
export const islandRadii = [6, 10, 14, 18, 22] as const;
/** The lifts the owner can choose, as a multiple of the usual shadow; none draws no shadow. */
export const islandLifts = [0, 0.5, 1, 2, 3] as const;

export type Islands = {
  readonly canvas: IslandCanvas;
  readonly gap: (typeof islandGaps)[number];
  readonly lift: (typeof islandLifts)[number];
  readonly radius: (typeof islandRadii)[number];
};

/** The prototype's settings, which the owner chose the theme from. */
export const defaultIslands: Islands = { canvas: "cool", gap: 10, lift: 1, radius: 14 };

const oneOf = <T>(options: ReadonlyArray<T>, value: unknown, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/** The settings a stored text names; each missing or unknown one is the default. */
export function islandsOf(stored: string | null): Islands {
  let parsed: Record<string, unknown> = {};
  try {
    const value: unknown = stored === null ? null : JSON.parse(stored);
    if (typeof value === "object" && value !== null) parsed = value as Record<string, unknown>;
  } catch {
    // Unreadable text keeps the defaults.
  }
  return {
    canvas: oneOf(islandCanvases, parsed.canvas, defaultIslands.canvas),
    gap: oneOf(islandGaps, parsed.gap, defaultIslands.gap),
    lift: oneOf(islandLifts, parsed.lift, defaultIslands.lift),
    radius: oneOf(islandRadii, parsed.radius, defaultIslands.radius),
  };
}

/** The canvas colors of each look: the plain color, and the glow that spreads from the lower right. */
const canvasColors = {
  dark: { cool: ["#111318", "#1a1e33"], flat: ["#111318", "#111318"], warm: ["#15130f", "#2a2116"] },
  light: { cool: ["#eceef1", "#e3e6f6"], flat: ["#eceef1", "#eceef1"], warm: ["#efece6", "#f2e4d3"] },
} as const satisfies Record<ColorScheme, Record<IslandCanvas, readonly [string, string]>>;

/** The canvas's plain color, and the CSS background that draws it with its glow. */
export function canvasOf(canvas: IslandCanvas, scheme: ColorScheme): { color: string; background: string } {
  const [color, glow] = canvasColors[scheme][canvas];
  return { background: `radial-gradient(60% 50% at 70% 85%, ${glow}, transparent 70%), ${color}`, color };
}

/** The hue of the shadow in each look: a cool grey on light, near black on dark. */
const shadowHues = { dark: "228deg 40% 2%", light: "222deg 18% 40%" } as const satisfies Record<ColorScheme, string>;

/** The three-layer shadow under an island, scaled by its lift; none at a lift of zero. */
export function islandShadowOf(lift: number, scheme: ColorScheme): string {
  if (lift === 0) return "none";
  const hue = shadowHues[scheme];
  const alpha = (base: number) => Math.round(base * lift * 1000) / 1000;
  return [
    `0 1px 1px hsl(${hue} / ${alpha(0.05)})`,
    `0 4px 10px -2px hsl(${hue} / ${alpha(0.07)})`,
    `0 18px 40px -12px hsl(${hue} / ${alpha(0.12)})`,
  ].join(", ");
}
