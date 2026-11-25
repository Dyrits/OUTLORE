import { channelTextOf, contrastOf, luminanceOf, mixColors } from "./colorMix";
import type { ColorScheme } from "./colorSchemeRules";
import type { Palette } from "./palettes";

// The Islands layout: the sidebar, each conversation pane, and the quest panel float as rounded panels on a canvas. It
// belongs to no theme: the canvas, the island, the hairline, and the shadow take their colors from the theme's palette.
// The owner picks the layout, then tunes the canvas, the gap between the panels, their corner radius, and how high they
// lift.

/** The layouts the owner can choose: floating islands, or the flat frame the app had before CHG-0672. */
export const layouts = ["islands", "flat"] as const;
export type Layout = (typeof layouts)[number];

/** The canvas under the islands: a cool or a warm glow, or plain. */
export const islandCanvases = ["cool", "warm", "flat"] as const;
export type IslandCanvas = (typeof islandCanvases)[number];

/** The gaps the owner can choose, in points. */
export const islandGaps = [4, 6, 8, 10, 14, 20] as const;
/** The corner radii the owner can choose, in points. */
export const islandRadii = [6, 10, 14, 18, 22] as const;
/** The lifts the owner can choose, as a multiple of the usual shadow; none draws no shadow. */
export const islandLifts = [0, 0.5, 1, 2, 3] as const;

/** The owner's layout and the Islands settings that apply while it is Islands. */
export type Islands = {
  readonly canvas: IslandCanvas;
  readonly gap: (typeof islandGaps)[number];
  readonly layout: Layout;
  readonly lift: (typeof islandLifts)[number];
  readonly radius: (typeof islandRadii)[number];
};

/** Islands is the default layout; the rest are the prototype's settings, which the owner chose it from. */
export const defaultIslands: Islands = { canvas: "cool", gap: 10, layout: "islands", lift: 1, radius: 14 };

const oneOf = <T>(options: ReadonlyArray<T>, value: unknown, fallback: T): T =>
  options.find((option) => option === value) ?? fallback;

/**
 * The settings a stored text names; each missing or unknown one is the default. Text saved while Islands was a theme
 * (CHG-0668) has no layout and keeps its canvas, gap, radius, and lift.
 */
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
    layout: oneOf(layouts, parsed.layout, defaultIslands.layout),
    lift: oneOf(islandLifts, parsed.lift, defaultIslands.lift),
    radius: oneOf(islandRadii, parsed.radius, defaultIslands.radius),
  };
}

/** The palette colors a canvas and its shadow are derived from. */
export type CanvasTones = Pick<Palette, "glowCool" | "glowWarm" | "ground" | "page" | "text">;

/** The least contrast, as a ratio, that tells the canvas from an island at a glance. */
const leastStep = 1.06;

/**
 * The canvas's plain color: the theme's `ground` when it is darker than the islands (`page`) by a visible step, as in
 * most themes. A theme with no such ground (One's dark ground is lighter than its page) gets its page shaded toward
 * black, and a page that is already black gets it lightened a little instead.
 */
export function canvasColorOf(tones: Pick<CanvasTones, "ground" | "page">, scheme: ColorScheme): string {
  const { ground, page } = tones;
  if (luminanceOf(ground) < luminanceOf(page) && contrastOf(ground, page) >= leastStep) return ground;
  const shaded = mixColors(page, "#000000", scheme === "dark" ? 0.55 : 0.08);
  return contrastOf(shaded, page) >= leastStep ? shaded : mixColors(page, "#ffffff", 0.11);
}

/** How much of the theme's glow tint the canvas takes at its brightest, in each look. */
const glowShares = { dark: 0.09, light: 0.07 } as const satisfies Record<ColorScheme, number>;

/**
 * The canvas's plain color, and the CSS background image that draws it with its glow spreading from the lower right.
 * The plain color is a layer of the image, so it needs no background color of its own beside it. A `shade` tints the
 * canvas's colors before they are drawn (the gap's, see `shadedCanvasOf`).
 */
export function canvasOf(
  canvas: IslandCanvas,
  tones: CanvasTones,
  scheme: ColorScheme,
  shade: (color: string) => string = (color) => color,
): { color: string; background: string } {
  const plain = canvasColorOf(tones, scheme);
  const tint = canvas === "warm" ? tones.glowWarm : tones.glowCool;
  const color = shade(plain);
  const glow = canvas === "flat" ? color : shade(mixColors(plain, tint, glowShares[scheme]));
  return {
    background: `radial-gradient(60% 50% at 70% 85%, ${glow}, transparent 70%), linear-gradient(${color}, ${color})`,
    color,
  };
}

/** How strong the shadow is in each look at a lift of one: the theme's ink is dark in the light look, so it is lighter. */
const shadowStrengths = { dark: 1, light: 0.6 } as const satisfies Record<ColorScheme, number>;

/** The layers of an island's shadow: their offset down, blur, spread, and strength at a lift of one in the dark look. */
const shadowLayers = [
  { alpha: 0.05, blur: 1, spread: 0, y: 1 },
  { alpha: 0.07, blur: 10, spread: -2, y: 4 },
  { alpha: 0.12, blur: 40, spread: -12, y: 18 },
] as const;

/** The color of the shadow's ink: the theme's text in the light look, and black in the dark look. */
const shadowInkOf = (scheme: ColorScheme, ink: string): string => (scheme === "dark" ? "#000000" : ink);

/**
 * The three-layer shadow under an island, scaled by its lift; none at a lift of zero. Its color is the ink of the
 * light look (the theme's text), and black in the dark look.
 */
export function islandShadowOf(lift: number, scheme: ColorScheme, ink: string): string {
  if (lift === 0) return "none";
  const channels = channelTextOf(shadowInkOf(scheme, ink));
  return shadowLayers
    .map(({ alpha, blur, spread, y }) => {
      const strength = Math.round(alpha * lift * shadowStrengths[scheme] * 1000) / 1000;
      return `0 ${y}px ${blur}px ${spread === 0 ? "" : `${spread}px `}rgb(${channels} / ${strength})`;
    })
    .join(", ");
}

/** The share of a normal distribution beyond `deviations` standard deviations (Abramowitz and Stegun, 7.1.26). */
function tailOf(deviations: number): number {
  const scaled = Math.abs(deviations) / Math.SQRT2;
  const term = 1 / (1 + 0.3275911 * scaled);
  const poly =
    term * (0.254829592 + term * (-0.284496736 + term * (1.421413741 + term * (-1.453152027 + term * 1.061405429))));
  const half = 0.5 * poly * Math.exp(-scaled * scaled);
  return deviations >= 0 ? half : 1 - half;
}

/**
 * How much of the canvas the islands' shadows cover `distance` from the edge of each of `neighbours` islands, from 0 to
 * 1. A blurred edge is a normal curve with a deviation of half the blur, so each layer covers `alpha` times the share
 * of that curve beyond the point, seen from its spread; the layers and the islands lay over each other.
 */
export function shadowCoverOf(distance: number, neighbours: number, lift: number, scheme: ColorScheme): number {
  let clear = 1;
  for (const { alpha, blur, spread } of shadowLayers) {
    const covered = alpha * lift * shadowStrengths[scheme] * tailOf((distance - spread) / (blur / 2));
    clear *= (1 - covered) ** neighbours;
  }
  return 1 - clear;
}

/**
 * A color as the canvas shows it in the gap between islands: under the shadows of the `neighbours` islands beside it,
 * which darken the gap's middle (`gap` / 2 from each edge) by a few steps. A notch drawn in the plain canvas color
 * looks lighter than the gap it stands in, so it takes this color.
 */
export function shadedByIslandsOf(
  color: string,
  {
    gap,
    ink,
    lift,
    neighbours,
    scheme,
  }: { gap: number; ink: string; lift: number; neighbours: number; scheme: ColorScheme },
): string {
  return mixColors(color, shadowInkOf(scheme, ink), shadowCoverOf(gap / 2, neighbours, lift, scheme));
}
