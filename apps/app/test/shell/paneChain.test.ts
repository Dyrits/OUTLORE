import { describe, expect, it } from "vitest";
import {
  chainOf,
  desktopThreadsOf,
  emptyPaneMemory,
  equalizedPanes,
  foldedPane,
  layoutOf,
  maxPanes,
  minPaneWidth,
  openedQuestMemory,
  type PaneMemory,
  prunedMemory,
  resizedWeights,
  revealedPane,
} from "../../src/shell/paneChain";

/** A quest whose thread `quest` has the errands `a` and `b`; `a` has `a1`, which has `a2`, then `a3`, and so on. */
const threads = [
  { id: "quest", parentId: null },
  { id: "a", parentId: "quest" },
  { id: "b", parentId: "quest" },
  { id: "a1", parentId: "a" },
  { id: "a2", parentId: "a1" },
  { id: "a3", parentId: "a2" },
];

describe("the chain of panes for the open thread", () => {
  it("is the quest's own thread alone when it is the one open", () => {
    expect(chainOf(threads, "quest")).toEqual(["quest"]);
  });

  it("runs from the quest down to an errand through its parents", () => {
    expect(chainOf(threads, "a2")).toEqual(["quest", "a", "a1", "a2"]);
  });

  it("holds an errand of the quest after the quest", () => {
    expect(chainOf(threads, "b")).toEqual(["quest", "b"]);
  });

  it("gives a legacy descendant the single errand slot and retains its tree path for Back", () => {
    const path = chainOf(threads, "a2");
    expect(desktopThreadsOf(path)).toEqual(["quest", "a2"]);
    expect(path.at(-2)).toBe("a1");
    expect(desktopThreadsOf(chainOf(threads, "quest"))).toEqual(["quest"]);
  });

  it("falls back to the quest's thread when the open thread is not in the tree", () => {
    expect(chainOf(threads, "gone")).toEqual(["quest"]);
    expect(chainOf(threads, null)).toEqual(["quest"]);
  });
});

const wide = 2000;
const memory = emptyPaneMemory<string>();
const layout = (chain: string[], overrides: Partial<PaneMemory<string>> = {}, available = wide) =>
  layoutOf({ available, chain, memory: { ...memory, ...overrides } });
const panes = (slots: ReturnType<typeof layout>) => slots.filter((slot) => slot.kind === "pane");
const strips = (slots: ReturnType<typeof layout>) => slots.filter((slot) => slot.kind === "strip");

describe("how the panes share the window", () => {
  it("gives one pane the whole width", () => {
    expect(layout(["quest"])).toEqual([{ depth: 0, id: "quest", kind: "pane", width: wide }]);
  });

  it("gives three panes a third each", () => {
    const slots = layout(["quest", "a", "a1"], {}, 1500);
    expect(panes(slots).map((slot) => slot.width)).toEqual([500, 500, 500]);
  });

  it("never shows more than three panes and folds the earlier ones of a longer chain to strips", () => {
    const slots = layout(["quest", "a", "a1", "a2", "a3"]);
    expect(panes(slots).map((slot) => slot.id)).toEqual(["a1", "a2", "a3"]);
    expect(strips(slots)).toEqual([
      { depth: 0, id: "quest", kind: "strip", reason: "overflow", width: 0 },
      { depth: 1, id: "a", kind: "strip", reason: "overflow", width: 0 },
    ]);
    expect(slots.reduce((sum, slot) => sum + slot.width, 0)).toBe(wide);
  });

  it("shows fewer panes in a window too narrow for three, folding the earliest to strips", () => {
    const slots = layout(["quest", "a", "a1", "a2"], {}, 1100);
    expect(panes(slots).map((slot) => slot.id)).toEqual(["a1", "a2"]);
    expect(strips(slots).map((slot) => [slot.id, slot.reason])).toEqual([
      ["quest", "overflow"],
      ["a", "narrow"],
    ]);
    for (const slot of panes(slots)) expect(slot.width).toBeGreaterThanOrEqual(minPaneWidth);
  });

  it("keeps the deepest pane even in a window narrower than one pane", () => {
    const slots = layout(["quest", "a"], {}, 300);
    expect(panes(slots).map((slot) => slot.id)).toEqual(["a"]);
  });

  it("keeps the panes and strips in the order of the chain", () => {
    const slots = layout(["quest", "a", "a1"], { folded: new Set(["a"]) });
    expect(slots.map((slot) => slot.id)).toEqual(["quest", "a", "a1"]);
  });
});

describe("folding and unfolding a pane", () => {
  it("expands a pane while keeping the previous folds and widths available to restore", () => {
    const chain = ["channel", "quest", "errand"];
    const remembered = { ...foldedPane(revealedPane(memory, "channel"), "errand"), weights: [500, 700, 0] };
    const input = { available: 1244, chain, memory: remembered };
    expect(panes(layoutOf({ ...input, expanded: "quest" }))).toEqual([
      { depth: 1, id: "quest", kind: "pane", width: 1244 },
    ]);
    expect(layoutOf({ ...input, expanded: null }).map((slot) => slot.width)).toEqual([518, 726, 0]);
  });

  it("gives folded panes no width, so their notches take no room from the open pane", () => {
    const slots = layoutOf({
      available: 1244,
      chain: ["channel", "quest", "errand"],
      memory: foldedPane(foldedPane(emptyPaneMemory<string>(), "channel"), "quest"),
    });
    expect(slots.map((slot) => [slot.kind, slot.width])).toEqual([
      ["strip", 0],
      ["strip", 0],
      ["pane", 1244],
    ]);
  });

  it("lets the open pane take the whole row with a folded pane on each side", () => {
    const slots = layoutOf({
      available: 1244,
      chain: ["channel", "quest", "errand"],
      memory: foldedPane(foldedPane(emptyPaneMemory<string>(), "channel"), "errand"),
    });
    expect(slots.map((slot) => slot.width)).toEqual([0, 1244, 0]);
  });

  it("folds the errand starter until it is revealed, and shows it where it fits once it is", () => {
    const input = { chain: ["channel", "quest", "starter"], memory, starter: "starter" };
    expect(panes(layoutOf({ ...input, available: wide })).map((slot) => slot.id)).toEqual(["channel", "quest"]);
    expect(panes(layoutOf({ ...input, available: 600 })).map((slot) => slot.id)).toEqual(["quest"]);
    expect(
      panes(layoutOf({ ...input, available: wide, memory: revealedPane(memory, "starter") })).map((slot) => slot.id),
    ).toEqual(input.chain);
    expect(
      panes(layoutOf({ ...input, available: 600, memory: revealedPane(memory, "starter") })).map((slot) => slot.id),
    ).toEqual(["starter"]);
  });

  it("shows a folded pane as a strip and lets the others share its room equally", () => {
    const slots = layout(["quest", "a", "a1"], { folded: new Set(["a"]) });
    expect(slots.map((slot) => slot.kind)).toEqual(["pane", "strip", "pane"]);
    expect(panes(slots).map((slot) => slot.width)).toEqual([1000, 1000]);
    expect(strips(slots)[0]).toMatchObject({ reason: "folded", width: 0 });
  });

  it("gives the channel its space back when the quest is folded in a narrow window", () => {
    const chain = ["channel", "quest"];
    const folded = foldedPane(memory, "quest");
    const slots = layout(chain, folded, 600);
    expect(panes(slots).map((slot) => slot.id)).toEqual(["channel"]);
    expect(strips(slots)[0]).toMatchObject({ id: "quest", reason: "folded" });
    expect(panes(layout(chain, revealedPane(folded, "quest"), 600)).map((slot) => slot.id)).toEqual(["quest"]);
  });

  it("remembers a fold in the memory and takes it back on unfolding", () => {
    const folded = foldedPane(memory, "a");
    expect([...folded.folded]).toEqual(["a"]);
    expect([...revealedPane(folded, "a").folded]).toEqual([]);
  });

  it("brings a strip back from the overflow by folding the next panes that fit least", () => {
    const chain = ["quest", "a", "a1", "a2", "a3"];
    const slots = layout(chain, revealedPane(memory, "quest"));
    expect(panes(slots).map((slot) => slot.id)).toEqual(["quest", "a2", "a3"]);
    expect(strips(slots).map((slot) => slot.id)).toEqual(["a", "a1"]);
  });

  it("brings a narrow strip back by folding the panes next to it that are not shown", () => {
    const chain = ["quest", "a", "a1", "a2"];
    const slots = layout(chain, revealedPane(memory, "quest"), 1100);
    expect(panes(slots).map((slot) => slot.id)).toEqual(["quest", "a2"]);
  });
});

describe("the memory of folds after the chain changes", () => {
  it("forgets panes that are no longer in the chain", () => {
    const remembered = foldedPane(foldedPane(memory, "a"), "b");
    expect([...prunedMemory(remembered, ["quest", "a"]).folded]).toEqual(["a"]);
  });
});

describe("dragging the edge between two panes", () => {
  const slots = layout(["quest", "a", "a1"]);

  it("moves room from one pane to the other and keeps their total", () => {
    const weights = resizedWeights({ dx: 100, leftId: "quest", rightId: "a", slots });
    const resized = layout(["quest", "a", "a1"], { weights });
    expect(panes(resized).map((slot) => slot.width)).toEqual([766, 566, 668]);
  });

  it("stops at the least width of the pane that shrinks", () => {
    const weights = resizedWeights({ dx: 5000, leftId: "quest", rightId: "a", slots });
    const resized = layout(["quest", "a", "a1"], { weights });
    expect(panes(resized)[1]?.width).toBe(minPaneWidth);
    expect(panes(resized)[2]?.width).toBe(668);
  });

  it("keeps the widths of panes that were not dragged", () => {
    const weights = resizedWeights({ dx: -100, leftId: "a", rightId: "a1", slots });
    const resized = layout(["quest", "a", "a1"], { weights });
    expect(panes(resized)[0]?.width).toBe(666);
  });
});

describe("the limits", () => {
  it("allows three panes", () => {
    expect(maxPanes).toBe(3);
  });
});

describe("equal widths", () => {
  const chain = ["quest", "a", "a1"];
  const dragged: PaneMemory<string> = { ...emptyPaneMemory<string>(), weights: [600, 500, 400] };

  it("gives the open panes the same share again, a third each with three", () => {
    const widths = layoutOf({ available: 1500, chain, memory: dragged }).map((slot) => slot.width);
    expect(widths).toEqual([600, 500, 400]);
    const equal = layoutOf({ available: 1500, chain, memory: equalizedPanes(dragged) }).map((slot) => slot.width);
    expect(equal).toEqual([500, 500, 500]);
  });

  it("keeps the folded panes folded and shares what they leave", () => {
    const folded = foldedPane({ ...dragged, weights: [700, 300, 500] }, "a");
    const slots = layoutOf({ available: 1244, chain, memory: equalizedPanes(folded) });
    expect(slots.map((slot) => slot.kind)).toEqual(["pane", "strip", "pane"]);
    expect(slots.map((slot) => slot.width)).toEqual([622, 0, 622]);
  });

  it("forgets the dragged shares, and nothing else", () => {
    const memory = foldedPane(dragged, "a");
    expect(equalizedPanes(memory)).toEqual({ ...memory, weights: [] });
  });
});

describe("the channel as the first level of the chain", () => {
  const channel = "channel";

  it("shares the room equally with a quest and an errand: a third each", () => {
    const slots = layoutOf({
      available: 1500,
      chain: [channel, "quest", "a"],
      memory: emptyPaneMemory<string>(),
    });
    expect(slots.map((slot) => slot.id)).toEqual([channel, "quest", "a"]);
    expect(slots.every((slot) => slot.kind === "pane" && slot.width === 500)).toBe(true);
  });

  it("is the first to fold when the chain outgrows three", () => {
    const slots = layoutOf({
      available: 1600,
      chain: [channel, "quest", "a", "a1"],
      memory: emptyPaneMemory<string>(),
    });
    expect(slots[0]).toMatchObject({ id: channel, kind: "strip", reason: "overflow" });
    expect(slots.slice(1).every((slot) => slot.kind === "pane")).toBe(true);
  });

  it("is the first to fold when the window is too narrow for the panes", () => {
    const slots = layoutOf({ available: 1100, chain: [channel, "quest", "a"], memory: emptyPaneMemory<string>() });
    expect(slots[0]).toMatchObject({ id: channel, kind: "strip", reason: "narrow" });
  });

  it("folds when the frame says it is folded, and the quest and its errands share what is left", () => {
    const slots = layoutOf({
      available: 1244,
      chain: [channel, "quest", "a"],
      memory: foldedPane(emptyPaneMemory<string>(), channel),
    });
    expect(slots.map((slot) => [slot.kind, slot.width])).toEqual([
      ["strip", 0],
      ["pane", 622],
      ["pane", 622],
    ]);
  });

  it("leaves a chain with no channel as it was", () => {
    const slots = layoutOf({ available: 1200, chain: ["quest", "a"], memory: emptyPaneMemory<string>() });
    expect(slots.map((slot) => slot.width)).toEqual([600, 600]);
  });
});

describe("a quest opened from the sidebar", () => {
  const channel = "channel";
  const starter = "starter";

  it("starts with the realm's channel folded, so the quest's conversation is the only pane open", () => {
    const slots = layoutOf({
      available: 1244,
      chain: [channel, "quest", starter],
      memory: openedQuestMemory(channel, []),
      starter,
    });
    expect(slots.map((slot) => [slot.id, slot.kind, slot.width])).toEqual([
      [channel, "strip", 0],
      ["quest", "pane", 1244],
      [starter, "strip", 0],
    ]);
  });

  it("folds the channel behind a revealed errand too, keeping the quest and its errand open", () => {
    const slots = layoutOf({
      available: 1244,
      chain: [channel, "quest", "errand"],
      memory: openedQuestMemory(channel, []),
    });
    expect(slots.map((slot) => [slot.id, slot.kind, slot.width])).toEqual([
      [channel, "strip", 0],
      ["quest", "pane", 622],
      ["errand", "pane", 622],
    ]);
  });

  it("keeps the dragged weights it opens with, for when another pane is revealed again", () => {
    expect(openedQuestMemory(channel, [800, 444])).toEqual({
      folded: new Set([channel]),
      shown: new Set(),
      weights: [800, 444],
    });
  });

  it("brings the channel back beside the quest when its notch is pressed", () => {
    const revealed = revealedPane(openedQuestMemory(channel, []), channel);
    expect([...revealed.folded]).toEqual([]);
    expect([...revealed.shown]).toEqual([channel]);
  });

  it("keeps the folded channel while the chain waits to load", () => {
    const opened = openedQuestMemory(channel, []);
    expect(prunedMemory(opened, [])).toEqual(opened);
  });
});

describe("a quest opened while the realm's channel is open", () => {
  const channel = "channel";

  it("leaves the channel open beside the quest instead of folding it", () => {
    const slots = layoutOf({
      available: 1244,
      chain: [channel, "quest"],
      memory: openedQuestMemory(channel, [], true),
    });
    expect(slots.map((slot) => [slot.id, slot.kind, slot.width])).toEqual([
      [channel, "pane", 622],
      ["quest", "pane", 622],
    ]);
  });

  it("still keeps the dragged weights", () => {
    expect(openedQuestMemory(channel, [800, 444], true)).toEqual({
      folded: new Set(),
      shown: new Set(),
      weights: [800, 444],
    });
  });
});
