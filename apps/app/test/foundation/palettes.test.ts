import { describe, expect, it } from "vitest";
import { palettes } from "../../src/foundation/palettes";
import { themes } from "../../src/foundation/themeRules";

const luminance = (hex: string): number => {
  const channel = (at: number) => {
    const value = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};
const contrast = (foreground: string, background: string): number => {
  const [high, low] = [luminance(foreground), luminance(background)].sort((current, next) => next - current);
  return ((high ?? 0) + 0.05) / ((low ?? 0) + 0.05);
};

describe.each(themes.flatMap((theme) => (["dark", "light"] as const).map((scheme) => [theme, scheme] as const)))(
  "the %s theme, %s look",
  (theme, scheme) => {
    const colors = palettes[theme][scheme];

    it("reads the text on the page, the sidebar, and the cards", () => {
      for (const ground of [colors.page, colors.sidebar, colors.surface, colors.bubble]) {
        expect(contrast(colors.text, ground)).toBeGreaterThanOrEqual(7);
      }
    });

    // Iskios's original colors stay unchanged; newer palettes meet the small-text threshold.
    it.runIf(theme !== "iskios")("reads the dimmer text and the accent on the page", () => {
      expect(contrast(colors.textMuted, colors.page)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.accentText, colors.page)).toBeGreaterThanOrEqual(4.5);
    });

    it.runIf(theme !== "iskios")("reads the label of an accent button", () => {
      expect(contrast(colors.onAccent, colors.accent)).toBeGreaterThanOrEqual(4.5);
    });

    it.runIf(theme !== "iskios")("reads messages and state labels on their tinted backgrounds", () => {
      expect(contrast(colors.accentText, colors.accentSoft)).toBeGreaterThanOrEqual(4.5);
      for (const background of [colors.bubbleUser, colors.accentSoft, colors.controlActive]) {
        expect(contrast(colors.text, background)).toBeGreaterThanOrEqual(4.5);
      }
      for (const [foreground, background] of [
        [colors.dangerText, colors.dangerSoft],
        [colors.successText, colors.successSoft],
        [colors.warningText, colors.warningSoft],
        [colors.violet, colors.violetSoft],
        [colors.underwayText, colors.underwaySoft],
      ]) {
        expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
      }
    });
  },
);

// What carries meaning stays colored in the black and white theme: the states' colors, whose indicators, rings, graphs,
// and dots are read by their hue. Every other color is a grey.
const meaningTokens = [
  "danger",
  "dangerSoft",
  "dangerText",
  "marker",
  "success",
  "successSoft",
  "successText",
  "underway",
  "underwaySoft",
  "underwayText",
  "violet",
  "violetSoft",
  "warning",
  "warningSoft",
  "warningText",
  "yellow",
  "yellowSoft",
] as const;

describe("the black and white theme", () => {
  const isGrey = (hex: string) => hex.slice(1, 3) === hex.slice(3, 5) && hex.slice(3, 5) === hex.slice(5, 7);

  it.each(["dark", "light"] as const)("has no hue in its %s look, outside the colors that carry meaning", (scheme) => {
    for (const [token, color] of Object.entries(palettes.mono[scheme])) {
      if (color.startsWith("#") && !(meaningTokens as ReadonlyArray<string>).includes(token)) {
        expect(isGrey(color), token).toBe(true);
      }
    }
  });

  it.each(["dark", "light"] as const)("keeps the colors that carry meaning colored in its %s look", (scheme) => {
    for (const token of meaningTokens) expect(isGrey(palettes.mono[scheme][token]), token).toBe(false);
  });

  it.each(["dark", "light"] as const)("gives each state its own hue in its %s look", (scheme) => {
    const { danger, success, underway, violet, warning } = palettes.mono[scheme];
    expect(new Set([danger, success, underway, violet, warning]).size).toBe(5);
  });
});
