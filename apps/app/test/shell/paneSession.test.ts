import { ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { emptyPaneMemory, foldedPane, layoutOf, openedQuestMemory, unfoldedPane } from "../../src/shell/paneChain";
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

  it("shows the channel alone while no quest is open, so a quest that opens next joins the pane that is mounted", () => {
    expect(paneContentsOf(null, null)).toEqual([{ id: channelId, kind: "channel" }]);
    const standalone = layoutOf({ available: 900, chain: [channelId], memory: emptyPaneMemory<PaneId>() });
    expect(standalone).toEqual([{ depth: 0, id: channelId, kind: "pane", width: 900 }]);
    // The channel stays the first pane, open, when the quest and its starter join the chain.
    const joined = layoutOf({
      available: 1200,
      chain: [channelId, quest, starterId],
      memory: emptyPaneMemory<PaneId>(),
      starter: starterId,
    });
    expect(joined.filter((slot) => slot.kind === "pane").map((slot) => slot.id)).toEqual([channelId, quest]);
  });

  it("opens a channel the owner folded beside a quest again when it is the only pane", () => {
    const folded = foldedPane(emptyPaneMemory<PaneId>(), channelId);
    expect(unfoldedPane(folded, channelId).folded.has(channelId)).toBe(false);
    expect(unfoldedPane(emptyPaneMemory<PaneId>(), channelId).folded.size).toBe(0);
    const untouched = emptyPaneMemory<PaneId>();
    expect(unfoldedPane(untouched, channelId)).toBe(untouched);
    expect(unfoldedPane(folded, channelId).shown.size).toBe(0);
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

  it("lets a folded quest and an expanded channel yield when the owner selects the quest again", () => {
    const folded = paneSessionOf(initial(), { chain: [channelId, quest], id: quest, type: "fold" });
    const expanded = paneSessionOf(folded, { id: channelId, type: "expand" });
    const reopened = paneSessionOf(expanded, { quest, type: "reopenQuest" });
    expect(reopened.expanded).toBeNull();
    expect(reopened.memory.folded.has(quest)).toBe(false);
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
