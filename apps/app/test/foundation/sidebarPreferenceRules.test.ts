import { describe, expect, it } from "vitest";
import { sidebarModeOf, sidebarPinnedOf, sidebarSideOf } from "../../src/foundation/sidebarPreferenceRules";

describe("the sidebar's stored mode", () => {
  it("is the overlay when nothing is stored", () => {
    expect(sidebarModeOf(null)).toBe("overlay");
  });

  it("keeps a stored docked mode", () => {
    expect(sidebarModeOf("docked")).toBe("docked");
  });

  it("falls back to the overlay for a value it does not know", () => {
    expect(sidebarModeOf("floating")).toBe("overlay");
    expect(sidebarModeOf("toString")).toBe("overlay");
  });
});

describe("the sidebar's stored side", () => {
  it("is the left edge when nothing is stored", () => {
    expect(sidebarSideOf(null)).toBe("left");
  });

  it("keeps a stored right edge", () => {
    expect(sidebarSideOf("right")).toBe("right");
  });

  it("falls back to the left edge for a value it does not know", () => {
    expect(sidebarSideOf("top")).toBe("left");
  });
});

describe("the sidebar's stored pin", () => {
  it("is unpinned when nothing is stored or the value is unknown", () => {
    expect(sidebarPinnedOf(null)).toBe(false);
    expect(sidebarPinnedOf("yes")).toBe(false);
  });

  it("keeps a stored pin", () => {
    expect(sidebarPinnedOf("true")).toBe(true);
    expect(sidebarPinnedOf("false")).toBe(false);
  });
});
