import { describe, expect, it } from "vitest";
import { isQuestTabOpen, panelAfterQuestIcon } from "../../src/shell/questTab";

describe("the quest icon in a quest's header", () => {
  it("is pressed only while the column shows the quest's tab", () => {
    expect(isQuestTabOpen({ activeTab: "quest", hasQuestPanel: true, isColumnOpen: true })).toBe(true);
    expect(isQuestTabOpen({ activeTab: "companion", hasQuestPanel: true, isColumnOpen: true })).toBe(false);
    expect(isQuestTabOpen({ activeTab: "quest", hasQuestPanel: true, isColumnOpen: false })).toBe(false);
    expect(isQuestTabOpen({ activeTab: "quest", hasQuestPanel: false, isColumnOpen: true })).toBe(false);
  });

  it("opens the quest tab, also from the Companions tab, and closes the column when pressed again", () => {
    expect(panelAfterQuestIcon(false)).toEqual({ tab: "quest" });
    expect(panelAfterQuestIcon(true)).toBeNull();
  });
});
