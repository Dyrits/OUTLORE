import { describe, expect, it } from "vitest";
import { realmMarkOf } from "../../src/shell/realmMark";

describe("a realm's mark", () => {
  it("shows Failed before Attention, and both before Underway", () => {
    expect(realmMarkOf(["Underway", "Attention", "Failed"])).toBe("Failed");
    expect(realmMarkOf(["Underway", "Attention"])).toBe("Attention");
  });

  it("shows Underway when a quest is and none needs the owner", () => {
    expect(realmMarkOf(["Resting", "Underway", "Stopped"])).toBe("Underway");
  });

  it("shows nothing for Resting, Waiting, Fresh, Stopped, Fulfilled or no quest", () => {
    expect(realmMarkOf(["Resting", "Waiting", "Fresh", "Stopped", "Fulfilled", "Archived"])).toBeNull();
    expect(realmMarkOf([])).toBeNull();
  });
});
