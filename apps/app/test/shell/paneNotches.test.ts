import { MissionId, ThreadId } from "@outlore/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { channelId } from "../../src/shell/paneIds";
import { notchWidth, paneNotchesOf, straddleReachOf } from "../../src/shell/paneNotches";

const quest = ThreadId.make("quest");
const errand = ThreadId.make("errand");
const revealPane = vi.fn();
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
    fullChain: [channelId, quest, errand],
    gap,
    missionId: MissionId.make("quest"),
    missions: [],
    onOpenMission: () => {},
    openList: () => {},
    revealPane,
    revealThread: () => {},
    slots: [
      { content: { id: channelId, kind: "channel" }, depth: 0, id: channelId, kind: "pane", width: 400 },
      isQuestFolded
        ? { content: { id: quest, kind: "quest" }, depth: 1, id: quest, kind: "strip", reason: "folded", width: 0 }
        : { content: { id: quest, kind: "quest" }, depth: 1, id: quest, kind: "pane", width: 400 },
      isQuestFolded
        ? { content: { id: errand, kind: "errand" }, depth: 2, id: errand, kind: "pane", width: 400 }
        : { content: { id: errand, kind: "errand" }, depth: 2, id: errand, kind: "strip", reason: "folded", width: 0 },
    ],
    threads: [
      ...(hasEarlierErrand
        ? [
            {
              id: ThreadId.make("earlier"),
              isArchived: false,
              lastActivityAt: 0,
              parentId: quest,
              shownState,
              title: "Earlier",
            },
          ]
        : []),
      { id: errand, isArchived, lastActivityAt: 0, parentId: quest, shownState, title: "Errand" },
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

describe("placing folded errand notches", () => {
  it("shares the notch padding across both open panes beside a folded quest", () => {
    const at = edges("Resting", false, true);
    expect(at(0).paddingRight).toBe(notchWidth / 2);
    expect(at(2)).toMatchObject({ isStraddling: true, paddingLeft: notchWidth / 2 });
  });

  it("places a folded errand among shortcuts in sidebar order", () => {
    const notches = edges("Resting", false, false, true)(1).right;
    expect(notches.map((part) => part.title)).toEqual(["Earlier", "Errand"]);
    notches[0]?.onReveal();
    notches[1]?.onReveal();
    expect(revealPane).toHaveBeenCalledWith(errand);
  });

  it("keeps a Fulfilled errand off the pane edge", () => {
    expect(questEdge("Fulfilled")).toEqual([]);
  });

  it("keeps an archived errand off the pane edge", () => {
    expect(questEdge("Resting", true)).toEqual([]);
  });

  it("reopens an active folded errand through its only notch", () => {
    const notches = questEdge("Resting");
    expect(notches).toMatchObject([{ id: errand, kind: "errand", state: "Resting", title: "Errand" }]);
    notches[0]?.onReveal();
    expect(revealPane).toHaveBeenCalledExactlyOnceWith(errand);
  });
});
