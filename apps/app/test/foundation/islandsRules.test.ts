import { describe, expect, it } from "vitest";
import { contrastOf, luminanceOf } from "../../src/foundation/colorMix";
import {
  canvasColorOf,
  canvasOf,
  defaultIslands,
  islandShadowOf,
  islandsOf,
  layouts,
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
