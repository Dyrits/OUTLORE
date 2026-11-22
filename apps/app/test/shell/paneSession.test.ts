import { ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { emptyPaneMemory, layoutOf, openedQuestMemory } from "../../src/shell/paneChain";
import { channelId, type PaneId, paneContentsOf, starterId } from "../../src/shell/paneIds";
import { type PaneSession, paneSessionOf } from "../../src/shell/paneSession";

const quest = ThreadId.make("quest");
const errand = ThreadId.make("errand");
const initial = (): PaneSession => ({
  expanded: null,
  focused: quest,
  listRequest: null,
  memory: emptyPaneMemory<PaneId>(),
});

describe("keeping the pane session", () => {
  it("keeps the channel folded while loading the quest and lets its notch bring it back", () => {
    const opened = { ...initial(), memory: openedQuestMemory<PaneId>(channelId, [1, 2]) };
    const loading = paneSessionOf(opened, { chain: [], deepest: null, type: "chain" });
    const loaded = paneSessionOf(loading, { chain: [channelId, quest, starterId], deepest: quest, type: "chain" });
    expect(loaded.memory.folded.has(channelId)).toBe(true);
    const revealed = paneSessionOf(loaded, { id: channelId, type: "reveal" });
    expect(revealed.memory.folded.has(channelId)).toBe(false);
    expect(revealed.memory.weights).toEqual([1, 2]);
  });

  it("uses the third slot for the selected errand or the starter", () => {
    expect(paneContentsOf(quest, errand)).toEqual([
      { id: channelId, kind: "channel" },
      { id: quest, kind: "quest" },
      { id: errand, kind: "errand" },
    ]);
    expect(paneContentsOf(quest, quest).at(-1)).toEqual({ id: starterId, kind: "starter" });
  });

  it("reopens a pane from its notch after expanding its neighbor", () => {
    const chain: ReadonlyArray<PaneId> = [channelId, quest, errand];
    const folded = paneSessionOf(initial(), { chain, id: errand, type: "fold" });
    const expanded = paneSessionOf(folded, { id: quest, type: "expand" });
    const openPanes = (session: PaneSession) =>
      layoutOf({ available: 1600, chain, expanded: session.expanded, memory: session.memory })
        .filter((slot) => slot.kind === "pane")
        .map((slot) => slot.id);
    expect(openPanes(expanded)).toEqual([quest]);
    const reopened = paneSessionOf(expanded, { id: channelId, type: "reveal" });
    expect(openPanes(reopened)).toEqual([channelId, quest]);
  });

  it("folds the starter when opening another quest", () => {
    const expanded = paneSessionOf(initial(), { id: quest, type: "expand" });
    const started = paneSessionOf(expanded, { type: "starter" });
    expect(started.expanded).toBe(starterId);
    expect(started.memory.shown.has(starterId)).toBe(true);
    const next = paneSessionOf(started, { type: "quest" });
    expect(next.expanded).toBeNull();
    expect(next.memory.shown.has(starterId)).toBe(false);
  });

  it("reveals a folded quest when opening its Chronicle target", () => {
    const folded = paneSessionOf(initial(), { chain: [channelId, quest, errand], id: quest, type: "fold" });
    const opened = paneSessionOf(folded, {
      quest,
      target: { messageId: null, questionId: null, threadId: null, waitingAt: null },
      thread: errand,
      type: "target",
    });
    expect(opened.focused).toBe(quest);
    expect(opened.memory.folded.has(quest)).toBe(false);
    expect(opened.memory.shown.has(quest)).toBe(true);
  });
});
