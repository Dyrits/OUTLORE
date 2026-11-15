import { describe, expect, it } from "vitest";
import { themeOf, themes } from "../../src/foundation/themeRules";

describe("themeOf", () => {
  it("reads a stored theme", () => {
    expect(themeOf("iskios")).toBe("iskios");
    expect(themeOf("gild")).toBe("gild");
    expect(themeOf("one")).toBe("one");
  });

  it("is One when nothing or something unknown is stored", () => {
    expect(themeOf(null)).toBe("one");
    expect(themeOf("sepia")).toBe("one");
  });

  it("offers One, Iskios, and Gild", () => {
    expect(themes).toEqual(["one", "iskios", "gild"]);
  });
});
