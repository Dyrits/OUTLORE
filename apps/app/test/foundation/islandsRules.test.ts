import { describe, expect, it } from "vitest";
import { canvasOf, defaultIslands, islandShadowOf, islandsOf } from "../../src/foundation/islandsRules";

describe("islandsOf", () => {
  it("is the prototype's settings when nothing is stored", () => {
    expect(islandsOf(null)).toEqual({ canvas: "cool", gap: 10, lift: 1, radius: 14 });
    expect(islandsOf(null)).toEqual(defaultIslands);
  });

  it("reads stored settings", () => {
    expect(islandsOf(JSON.stringify({ canvas: "warm", gap: 20, lift: 0, radius: 6 }))).toEqual({
      canvas: "warm",
      gap: 20,
      lift: 0,
      radius: 6,
    });
  });

  it("keeps the default for each unknown or missing setting, and for unreadable text", () => {
    expect(islandsOf(JSON.stringify({ canvas: "sepia", gap: 11, radius: 22 }))).toEqual({
      ...defaultIslands,
      radius: 22,
    });
    expect(islandsOf("{not json")).toEqual(defaultIslands);
    expect(islandsOf("7")).toEqual(defaultIslands);
  });
});

describe("islandShadowOf", () => {
  it("draws no shadow at a lift of zero", () => {
    expect(islandShadowOf(0, "light")).toBe("none");
  });

  it("scales the shadow's strength with the lift", () => {
    expect(islandShadowOf(1, "light")).toContain("/ 0.12)");
    expect(islandShadowOf(2, "light")).toContain("/ 0.24)");
    expect(islandShadowOf(1, "dark")).not.toBe(islandShadowOf(1, "light"));
  });
});

describe("canvasOf", () => {
  it("draws a glow over the plain color, except on the flat canvas", () => {
    const cool = canvasOf("cool", "light");
    expect(cool.color).toBe("#eceef1");
    expect(cool.background).toContain("radial-gradient");
    expect(cool.background.endsWith("#eceef1")).toBe(true);
    expect(canvasOf("warm", "dark").color).toBe("#15130f");
    const flat = canvasOf("flat", "light");
    expect(flat.background).toContain(`${flat.color}, transparent`);
  });
});
