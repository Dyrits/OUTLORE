import { describe, expect, it } from "vitest";
import { lightboxBoundsOf, lightboxIndexAfter, lightboxKeyActionOf } from "../../src/attachments/imageLightboxLogic";

describe("image lightbox navigation and layout rules", () => {
  it("maps Escape and horizontal arrow keys to lightbox actions", () => {
    expect(lightboxKeyActionOf("Escape")).toBe("close");
    expect(lightboxKeyActionOf("ArrowLeft")).toBe("previous");
    expect(lightboxKeyActionOf("ArrowRight")).toBe("next");
  });

  it("ignores unrelated keys and inherited object property names", () => {
    expect(lightboxKeyActionOf("Enter")).toBeNull();
    expect(lightboxKeyActionOf("toString")).toBeNull();
  });

  it("steps through images and clamps at both ends", () => {
    expect(lightboxIndexAfter(0, 3, "next")).toBe(1);
    expect(lightboxIndexAfter(2, 3, "next")).toBe(2);
    expect(lightboxIndexAfter(2, 3, "previous")).toBe(1);
    expect(lightboxIndexAfter(0, 3, "previous")).toBe(0);
    expect(lightboxIndexAfter(0, 0, "next")).toBe(0);
  });

  it("bounds panel and image dimensions to the window size", () => {
    expect(lightboxBoundsOf(1440, 900)).toEqual({
      imageHeight: 744,
      imageWidth: 1168,
      panelMaxHeight: 860,
      panelMaxWidth: 1200,
    });
    expect(lightboxBoundsOf(320, 480)).toEqual({
      imageHeight: 324,
      imageWidth: 248,
      panelMaxHeight: 440,
      panelMaxWidth: 280,
    });
  });
});
