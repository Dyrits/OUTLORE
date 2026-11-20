import { MissionId, ThreadId } from "@outlore/contracts";
import { describe, expect, it, vi } from "vitest";
import { channelId } from "../../src/shell/paneIds";
import { paneNotchesOf } from "../../src/shell/paneNotches";

const quest = ThreadId.make("quest");
const errand = ThreadId.make("errand");
const revealPane = vi.fn();

function questEdge(shownState: "Fulfilled" | "Resting", isArchived = false) {
  return paneNotchesOf({
    channel: { id: null, name: "Borderlands" },
    fullChain: [channelId, quest, errand],
    missionId: MissionId.make("quest"),
    missions: [],
    onOpenMission: () => {},
    openList: () => {},
    quest,
    revealPane,
    revealThread: () => {},
    slots: [
      { depth: 0, id: channelId, kind: "pane", width: 400 },
      { depth: 1, id: quest, kind: "pane", width: 400 },
      { depth: 2, id: errand, kind: "strip", reason: "folded", width: 0 },
    ],
    threads: [{ id: errand, isArchived, lastActivityAt: 0, parentId: quest, shownState, title: "Errand" }],
  })(1).right;
}

describe("placing folded errand notches", () => {
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
