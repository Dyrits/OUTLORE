import { describe, expect, it } from "vitest";
import { themeOf, themes } from "../../src/foundation/themeRules";

describe("themeOf", () => {
  it("reads a stored theme", () => {
    expect(themeOf("iskios")).toBe("iskios");
    expect(themeOf("one")).toBe("one");
  });

  it("is One when nothing or something unknown is stored", () => {
    expect(themeOf(null)).toBe("one");
    expect(themeOf("sepia")).toBe("one");
    // Gild was removed (CHG-0449); a saved selection of it opens in One.
    expect(themeOf("gild")).toBe("one");
  });

  it("offers One and Iskios", () => {
    expect(themes).toEqual(["one", "iskios"]);
  });
});
