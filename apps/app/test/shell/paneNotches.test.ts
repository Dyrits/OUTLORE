import { MissionId, ThreadId } from "@outlore/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { channelId } from "../../src/shell/paneIds";
import { notchWidth, paneNotchesOf, straddleReachOf } from "../../src/shell/paneNotches";

const quest = ThreadId.make("quest");
const errand = ThreadId.make("errand");
const revealPane = vi.fn();
const openList = vi.fn();
const startQuest = vi.fn();
const startErrand = vi.fn();
beforeEach(() => vi.clearAllMocks());

function edges(
  shownState: "Fulfilled" | "Resting",
  isArchived = false,
  isQuestFolded = false,
  hasEarlierErrand = false,
  gap = 0,
) {
  return paneNotchesOf({
    channel: { id: null, name: "Borderlands" },
    gap,
    missionId: MissionId.make("quest"),
    missions: [],
    openList,
    revealPane,
    slots: [
      { content: { id: channelId, kind: "channel" }, depth: 0, id: channelId, kind: "pane", width: 400 },
      isQuestFolded
        ? { content: { id: quest, kind: "quest" }, depth: 1, id: quest, kind: "strip", reason: "folded", width: 0 }
        : { content: { id: quest, kind: "quest" }, depth: 1, id: quest, kind: "pane", width: 400 },
      isQuestFolded
        ? { content: { id: errand, kind: "errand" }, depth: 2, id: errand, kind: "pane", width: 400 }
        : { content: { id: errand, kind: "errand" }, depth: 2, id: errand, kind: "strip", reason: "folded", width: 0 },
    ],
    startErrand,
    startQuest,
    threads: [
      ...(hasEarlierErrand
        ? [
            {
              id: ThreadId.make("earlier"),
              isArchived: false,
              parentId: quest,
              shownState,
              title: "Earlier",
            },
          ]
        : []),
      { id: errand, isArchived, parentId: quest, shownState, title: "Errand" },
    ],
  });
}

const questEdge = (shownState: "Fulfilled" | "Resting", isArchived = false) => edges(shownState, isArchived)(1).right;

describe("placing a notch between islands", () => {
  it("reaches into each pane by what the gap leaves of half the notch", () => {
    expect(straddleReachOf(0)).toBe(notchWidth / 2);
    expect(straddleReachOf(10)).toBe((notchWidth - 10) / 2);
    expect(straddleReachOf(notchWidth)).toBe(0);
    expect(straddleReachOf(40)).toBe(0);
  });

  it("pads the two open panes beside a folded quest by that reach", () => {
    const at = edges("Resting", false, true, false, 10);
    expect(at(0).paddingRight).toBe(straddleReachOf(10));
    expect(at(2)).toMatchObject({ isStraddling: true, paddingLeft: straddleReachOf(10) });
  });
});

describe("placing child navigation notches", () => {
  it("shares the notch padding across both open panes beside a folded quest", () => {
    const at = edges("Resting", false, true);
    expect(at(0).paddingRight).toBe(notchWidth / 2);
    expect(at(2)).toMatchObject({ isStraddling: true, paddingLeft: notchWidth / 2 });
  });

  it("opens the folded parent directly", () => {
    const parent = edges("Resting", false, true)(2).left[0];
    expect(parent).toMatchObject({ id: quest, kind: "quest" });
    parent?.onReveal();
    expect(revealPane).toHaveBeenCalledExactlyOnceWith(quest);
  });

  it("keeps two controls and includes the folded errand in the list status", () => {
    const notches = edges("Resting", false, false, true)(1).right;
    expect(notches).toMatchObject([
      { isNew: true, kind: "errand", title: "New errand" },
      { kind: "list", state: "Resting", title: "Errands" },
    ]);
    notches[0]?.onReveal();
    notches[1]?.onReveal();
    expect(startErrand).toHaveBeenCalledExactlyOnceWith(quest);
    expect(openList).toHaveBeenCalledExactlyOnceWith(quest);
    expect(revealPane).not.toHaveBeenCalled();
  });

  it.each([
    ["Fulfilled", false],
    ["Resting", true],
  ] as const)(
    "keeps the list available without a status dot for an inactive errand (%s, archived %s)",
    (state, isArchived) => {
      expect(questEdge(state, isArchived)).toMatchObject([{ title: "New errand" }, { state: null, title: "Errands" }]);
    },
  );
});
