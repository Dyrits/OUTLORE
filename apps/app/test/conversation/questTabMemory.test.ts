import { describe, expect, it } from "vitest";
import { initialQuestTabOf } from "../../src/conversation/questTabMemory";

describe("the tab a quest's pane opens on", () => {
  it("opens on Missives when no quest has shown another tab", () => {
    expect(initialQuestTabOf({ hasListRequest: false, remembered: null })).toBe("Missives");
  });

  it("stays on the tab the previous quest's pane showed, so errands can be browsed quest after quest", () => {
    expect(initialQuestTabOf({ hasListRequest: false, remembered: "Errands" })).toBe("Errands");
    expect(initialQuestTabOf({ hasListRequest: false, remembered: "Quest" })).toBe("Quest");
    expect(initialQuestTabOf({ hasListRequest: false, remembered: "Companions" })).toBe("Companions");
  });

  it("opens on Errands when a notch or the sidebar asks for the list, whatever was remembered", () => {
    expect(initialQuestTabOf({ hasListRequest: true, remembered: "Missives" })).toBe("Errands");
    expect(initialQuestTabOf({ hasListRequest: true, remembered: null })).toBe("Errands");
  });
});
