import { describe, expect, it } from "vitest";
import { tierNameOf } from "../../src/settings/tierNames";

describe("naming a built-in tier from a preset key", () => {
  it("names a built-in tier", () => {
    expect(tierNameOf("Heavy")).toBe("Heavy");
  });

  it("names no tier for a custom preset", () => {
    expect(tierNameOf("custom:Heavy")).toBeNull();
  });

  it("names no tier for the default Companion", () => {
    expect(tierNameOf("Default")).toBeNull();
  });
});
