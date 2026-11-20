import { describe, expect, it } from "vitest";
import { realmMarkOf } from "../../src/foundation/realmMark";

describe("a realm's mark", () => {
  it("shows Failed before Attention, and both before Underway", () => {
    expect(realmMarkOf(["Underway", "Attention", "Failed"])).toBe("Failed");
    expect(realmMarkOf(["Underway", "Attention"])).toBe("Attention");
  });

  it("shows Underway when a quest is and none needs the owner", () => {
    expect(realmMarkOf(["Resting", "Underway", "Stopped"])).toBe("Underway");
  });

  it("shows Resting when a quest rests and none has a higher priority", () => {
    expect(realmMarkOf(["Resting", "Fresh"])).toBe("Resting");
  });

  it("shows Waiting above Resting and below Underway", () => {
    expect(realmMarkOf(["Waiting", "Resting"])).toBe("Waiting");
    expect(realmMarkOf(["Waiting", "Underway"])).toBe("Underway");
  });

  it("shows Fulfilled when all unarchived quests are fulfilled", () => {
    expect(realmMarkOf(["Fulfilled", "Fulfilled", "Archived"])).toBe("Fulfilled");
    expect(realmMarkOf(["Fulfilled", "Fresh"])).toBeNull();
    expect(realmMarkOf(["Archived"])).toBeNull();
  });

  it("shows nothing for Fresh, Stopped or no quest", () => {
    expect(realmMarkOf(["Fresh", "Stopped", "Fulfilled", "Archived"])).toBeNull();
    expect(realmMarkOf([])).toBeNull();
  });
});
