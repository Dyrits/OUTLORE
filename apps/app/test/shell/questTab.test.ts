import { describe, expect, it } from "vitest";
import { isQuestTabOpen, paneIconPress, panelAfterQuestIcon, wasFollowedAtPress } from "../../src/shell/questTab";

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

describe("the quest icon of one pane among several", () => {
  it("moves the open panel to the pane pressed instead of closing it", () => {
    expect(paneIconPress({ isOpen: true, wasFollowed: false })).toBe("switch");
  });

  it("closes the panel from the pane it follows, and opens it from any pane when shut", () => {
    expect(paneIconPress({ isOpen: true, wasFollowed: true })).toBe("toggle");
    expect(paneIconPress({ isOpen: false, wasFollowed: false })).toBe("toggle");
    expect(paneIconPress({ isOpen: false, wasFollowed: true })).toBe("toggle");
  });

  it("reads the pane the panel followed before the pointer went down, since the pane takes focus on the way", () => {
    const pointer = { at: 1000, followedBefore: "a" };
    expect(wasFollowedAtPress({ followedNow: "b", id: "b", now: 1100, pointer })).toBe(false);
    expect(wasFollowedAtPress({ followedNow: "a", id: "a", now: 1100, pointer })).toBe(true);
  });

  it("uses the panel's current pane when no pointer went down just before, as with the keyboard", () => {
    expect(wasFollowedAtPress({ followedNow: "b", id: "b", now: 1000, pointer: null })).toBe(true);
    expect(wasFollowedAtPress({ followedNow: "a", id: "b", now: 1000, pointer: null })).toBe(false);
    expect(
      wasFollowedAtPress({ followedNow: "b", id: "b", now: 5000, pointer: { at: 1000, followedBefore: "a" } }),
    ).toBe(true);
  });
});
