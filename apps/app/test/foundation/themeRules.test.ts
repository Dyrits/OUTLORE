import { describe, expect, it } from "vitest";
import { themeOf, themes } from "../../src/foundation/themeRules";

describe("themeOf", () => {
  it("reads a stored theme", () => {
    expect(themeOf("iskios")).toBe("iskios");
    expect(themeOf("one")).toBe("one");
    expect(themeOf("mono")).toBe("mono");
    expect(themeOf("slate")).toBe("slate");
  });

  it("reads the Islands theme an earlier build stored as Slate, which has its colors", () => {
    expect(themeOf("islands")).toBe("slate");
  });

  it("is One when nothing or something unknown is stored", () => {
    expect(themeOf(null)).toBe("one");
    expect(themeOf("sepia")).toBe("one");
    // Gild was removed (CHG-0449); a saved selection of it opens in One.
    expect(themeOf("gild")).toBe("one");
  });

  it("offers One, Iskios, Black & white, and Slate", () => {
    expect(themes).toEqual(["one", "iskios", "mono", "slate"]);
  });
});
