import { describe, expect, it } from "vitest";
import { dragCarriesQuest } from "../../src/shell/questDragTypes";
import {
  hotZoneWidth,
  isOutsideOverlay,
  overlayDelays,
  overlayWishOf,
  sidebarPlacementOf,
} from "../../src/shell/sidebarMode";

const base = {
  isDragging: false,
  isOpen: false,
  isResizing: false,
  panelWidth: 300,
  side: "left",
  windowWidth: 1600,
} as const;

describe("when the pointer asks the overlay sidebar to open", () => {
  it("opens when the pointer reaches the left edge of a sidebar set to the left", () => {
    expect(overlayWishOf({ ...base, x: 0 })).toBe("open");
    expect(overlayWishOf({ ...base, x: hotZoneWidth - 1 })).toBe("open");
  });

  it("stays shut when the pointer is past the hot zone", () => {
    expect(overlayWishOf({ ...base, x: hotZoneWidth + 1 })).toBe("stay");
  });

  it("opens at the right edge of a sidebar set to the right, and not at the left", () => {
    const right = { ...base, side: "right" } as const;
    expect(overlayWishOf({ ...right, x: 1599 })).toBe("open");
    expect(overlayWishOf({ ...right, x: 2 })).toBe("stay");
  });

  it("does nothing when the pointer has left the window", () => {
    expect(overlayWishOf({ ...base, x: null })).toBe("stay");
  });
});

describe("when the pointer asks the open overlay sidebar to close", () => {
  const open = { ...base, isOpen: true } as const;

  it("stays open while the pointer is over the panel", () => {
    expect(overlayWishOf({ ...open, x: 200 })).toBe("stay");
    expect(overlayWishOf({ ...open, x: 300 })).toBe("stay");
  });

  it("closes when the pointer moves past the panel", () => {
    expect(overlayWishOf({ ...open, x: 340 })).toBe("close");
  });

  it("closes when the pointer leaves the window", () => {
    expect(overlayWishOf({ ...open, x: null })).toBe("close");
  });

  it("measures the panel from the right edge when the sidebar is set to the right", () => {
    const right = { ...open, side: "right" } as const;
    expect(overlayWishOf({ ...right, x: 1400 })).toBe("stay");
    expect(overlayWishOf({ ...right, x: 1200 })).toBe("close");
  });
});

describe("the overlay sidebar while something is dragged", () => {
  it("stays open while a quest is dragged, wherever the pointer is", () => {
    expect(overlayWishOf({ ...base, isDragging: true, isOpen: true, x: 900 })).toBe("stay");
    expect(overlayWishOf({ ...base, isDragging: true, isOpen: true, x: null })).toBe("stay");
  });

  it("opens when a quest is dragged to the edge", () => {
    expect(overlayWishOf({ ...base, isDragging: true, x: 2 })).toBe("open");
  });

  it("stays open while its edge is dragged to resize it", () => {
    expect(overlayWishOf({ ...base, isOpen: true, isResizing: true, x: 900 })).toBe("stay");
  });
});

describe("a press outside the open overlay sidebar", () => {
  it("is outside past the panel's width on the left", () => {
    expect(isOutsideOverlay({ panelWidth: 300, side: "left", windowWidth: 1600, x: 301 })).toBe(true);
    expect(isOutsideOverlay({ panelWidth: 300, side: "left", windowWidth: 1600, x: 120 })).toBe(false);
  });

  it("is outside before the panel's width on the right", () => {
    expect(isOutsideOverlay({ panelWidth: 300, side: "right", windowWidth: 1600, x: 1200 })).toBe(true);
    expect(isOutsideOverlay({ panelWidth: 300, side: "right", windowWidth: 1600, x: 1400 })).toBe(false);
  });
});

describe("the overlay sidebar's delays", () => {
  it("waits before opening so that a stray pointer does not trigger it, and a shorter time before closing", () => {
    expect(overlayDelays.open).toBeGreaterThanOrEqual(120);
    expect(overlayDelays.close).toBeLessThan(overlayDelays.open);
  });
});

describe("a drag that carries a quest", () => {
  it("is recognized by the quest's drag type", () => {
    expect(dragCarriesQuest(["application/x-outlore-quest"])).toBe(true);
  });

  it("is not a realm's or a file's drag", () => {
    expect(dragCarriesQuest(["application/x-outlore-realm"])).toBe(false);
    expect(dragCarriesQuest(["Files"])).toBe(false);
  });
});

describe("where the sidebar stands", () => {
  it("floats until it is pinned, and then takes its place in the frame", () => {
    expect(sidebarPlacementOf({ isPinned: false, mode: "overlay" })).toBe("floating");
    expect(sidebarPlacementOf({ isPinned: true, mode: "overlay" })).toBe("pinned");
  });

  it("is docked in the docked mode, pinned or not", () => {
    expect(sidebarPlacementOf({ isPinned: false, mode: "docked" })).toBe("docked");
    expect(sidebarPlacementOf({ isPinned: true, mode: "docked" })).toBe("docked");
  });
});
