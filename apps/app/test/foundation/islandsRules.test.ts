import { describe, expect, it } from "vitest";
import { contrastOf, luminanceOf } from "../../src/foundation/colorMix";
import {
  canvasColorOf,
  canvasOf,
  defaultIslands,
  islandShadowOf,
  islandsOf,
  layouts,
  shadedByIslandsOf,
  shadowCoverOf,
} from "../../src/foundation/islandsRules";
import { palettes } from "../../src/foundation/palettes";
import { themes } from "../../src/foundation/themeRules";

describe("islandsOf", () => {
  it("is the Islands layout with the prototype's settings when nothing is stored", () => {
    expect(islandsOf(null)).toEqual({ canvas: "cool", gap: 10, layout: "islands", lift: 1, radius: 14 });
    expect(islandsOf(null)).toEqual(defaultIslands);
    expect(layouts).toEqual(["islands", "flat"]);
  });

  it("reads stored settings, the layout too", () => {
    expect(islandsOf(JSON.stringify({ canvas: "warm", gap: 20, layout: "flat", lift: 0, radius: 6 }))).toEqual({
      canvas: "warm",
      gap: 20,
      layout: "flat",
      lift: 0,
      radius: 6,
    });
  });

  it("keeps the canvas, gap, lift, and radius saved while Islands was a theme, in the Islands layout", () => {
    // The text CHG-0668 stored, with no layout.
    const saved = JSON.stringify({ canvas: "warm", gap: 6, lift: 2, radius: 22 });
    expect(islandsOf(saved)).toEqual({ canvas: "warm", gap: 6, layout: "islands", lift: 2, radius: 22 });
  });

  it("keeps the default for each unknown or missing setting, and for unreadable text", () => {
    expect(islandsOf(JSON.stringify({ canvas: "sepia", gap: 11, layout: "grid", radius: 22 }))).toEqual({
      ...defaultIslands,
      radius: 22,
    });
    expect(islandsOf("{not json")).toEqual(defaultIslands);
    expect(islandsOf("7")).toEqual(defaultIslands);
  });
});

describe("islandShadowOf", () => {
  it("draws no shadow at a lift of zero", () => {
    expect(islandShadowOf(0, "light", "#2a2d34")).toBe("none");
  });

  it("scales the shadow's strength with the lift", () => {
    expect(islandShadowOf(1, "dark", "#ffffff")).toContain("/ 0.12)");
    expect(islandShadowOf(2, "dark", "#ffffff")).toContain("/ 0.24)");
    expect(islandShadowOf(1, "light", "#2a2d34")).toContain("/ 0.072)");
  });

  it("is the theme's ink in the light look and black in the dark one", () => {
    expect(islandShadowOf(1, "light", "#2a2d34")).toContain("rgb(42 45 52 /");
    expect(islandShadowOf(1, "dark", "#dce0e5")).toContain("rgb(0 0 0 /");
  });
});

describe("shadowCoverOf", () => {
  it("covers nothing where there is no shadow", () => {
    expect(shadowCoverOf(5, 2, 0, "light")).toBe(0);
  });

  it("grows with the lift and the islands beside, and fades with the distance from them", () => {
    expect(shadowCoverOf(5, 1, 2, "light")).toBeGreaterThan(shadowCoverOf(5, 1, 1, "light"));
    expect(shadowCoverOf(5, 2, 1, "light")).toBeGreaterThan(shadowCoverOf(5, 1, 1, "light"));
    expect(shadowCoverOf(10, 1, 1, "light")).toBeLessThan(shadowCoverOf(5, 1, 1, "light"));
    expect(shadowCoverOf(200, 2, 3, "dark")).toBeLessThan(0.001);
  });

  it("is stronger in the dark look, whose ink is black", () => {
    expect(shadowCoverOf(5, 2, 1, "dark")).toBeGreaterThan(shadowCoverOf(5, 2, 1, "light"));
  });
});

describe("shadedByIslandsOf", () => {
  // The One theme's light canvas, and the colors a window read at the middle of the gap between two islands (2026-11-23).
  const { text } = palettes.one.light;
  const canvas = canvasColorOf(palettes.one.light, "light");
  const channelOf = (hex: string) => Number.parseInt(hex.slice(1, 3), 16);
  const shaded = (gap: number, lift: number) =>
    shadedByIslandsOf(canvas, { gap, ink: text, lift, neighbours: 2, scheme: "light" });

  it("keeps the canvas where the islands cast no shadow", () => {
    expect(shaded(10, 0)).toBe(canvas);
  });

  it.each([
    [10, 1, 212],
    [20, 1, 216],
    [10, 3, 201],
    [20, 3, 210],
  ])("matches what the gap shows within three steps: gap %i, lift %f is %i", (gap, lift, measured) => {
    expect(canvas).toBe("#dcdcdd");
    expect(Math.abs(channelOf(shaded(gap, lift)) - measured)).toBeLessThanOrEqual(3);
  });

  it("darkens a notch less beside one island than between two", () => {
    const beside = shadedByIslandsOf(canvas, { gap: 10, ink: text, lift: 1, neighbours: 1, scheme: "light" });
    expect(channelOf(beside)).toBeGreaterThan(channelOf(shaded(10, 1)));
    expect(channelOf(beside)).toBeLessThan(channelOf(canvas));
  });
});

describe("canvasColorOf", () => {
  it("is the ground where the ground is darker than the islands by a visible step", () => {
    expect(canvasColorOf({ ground: "#eceef1", page: "#fbfbfc" }, "light")).toBe("#eceef1");
    expect(canvasColorOf({ ground: "#111318", page: "#1b1e25" }, "dark")).toBe("#111318");
  });

  it("shades the page where the ground is lighter than it, as in One's dark look", () => {
    const canvas = canvasColorOf({ ground: "#3b414d", page: "#282c33" }, "dark");
    expect(luminanceOf(canvas)).toBeLessThan(luminanceOf("#282c33"));
    expect(canvas).not.toBe("#3b414d");
  });

  it("lightens a page that is already black", () => {
    expect(luminanceOf(canvasColorOf({ ground: "#000000", page: "#000000" }, "dark"))).toBeGreaterThan(0);
  });
});

describe.each(themes.flatMap((theme) => (["dark", "light"] as const).map((scheme) => [theme, scheme] as const)))(
  "the %s theme's canvas, %s look",
  (theme, scheme) => {
    const palette = palettes[theme][scheme];

    it("is told from the islands at a glance", () => {
      expect(contrastOf(canvasColorOf(palette, scheme), palette.page)).toBeGreaterThanOrEqual(1.06);
    });

    it("draws a glow over the plain color, except on the flat canvas", () => {
      const cool = canvasOf("cool", palette, scheme);
      expect(cool.background).toContain("radial-gradient");
      expect(cool.background.endsWith(`linear-gradient(${cool.color}, ${cool.color})`)).toBe(true);
      const flat = canvasOf("flat", palette, scheme);
      expect(flat.background).toContain(`${flat.color}, transparent`);
      expect(canvasOf("warm", palette, scheme).color).toBe(cool.color);
    });
  },
);

describe("canvasOf with a shade", () => {
  it("shades the plain color and the glow alike, as the gap between islands shows them", () => {
    const palette = palettes.slate.light;
    const shade = (color: string) =>
      shadedByIslandsOf(color, { gap: 10, ink: palette.text, lift: 3, neighbours: 2, scheme: "light" });
    const plain = canvasOf("cool", palette, "light");
    const shaded = canvasOf("cool", palette, "light", shade);
    expect(shaded.color).toBe(shade(plain.color));
    expect(shaded.color).not.toBe(plain.color);
    const glows = (background: string) => background.match(/#[0-9a-f]{6}/g) ?? [];
    expect(glows(shaded.background)).toEqual(glows(plain.background).map(shade));
  });
});

describe("the canvas of the black and white theme", () => {
  it.each(["dark", "light"] as const)("stays grey in its glow, %s look", (scheme) => {
    for (const canvas of ["cool", "warm"] as const) {
      const colors = canvasOf(canvas, palettes.mono[scheme], scheme).background.match(/#[0-9a-f]{6}/g) ?? [];
      expect(colors.length).toBeGreaterThan(0);
      for (const color of colors)
        expect(color.slice(1, 3) === color.slice(3, 5) && color.slice(3, 5) === color.slice(5, 7)).toBe(true);
    }
  });
});
