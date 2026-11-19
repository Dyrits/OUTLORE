import { describe, expect, it } from "vitest";
import {
  chainOf,
  emptyPaneMemory,
  equalizedPanes,
  foldedPane,
  layoutOf,
  maxPanes,
  minPaneWidth,
  type PaneMemory,
  prunedMemory,
  resizedWeights,
  revealedPane,
  stripWidth,
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

  it("gives four panes a quarter each", () => {
    const slots = layout(["quest", "a", "a1", "a2"]);
    expect(panes(slots).map((slot) => slot.width)).toEqual([500, 500, 500, 500]);
  });

  it("never shows more than four panes and folds the earlier ones of a longer chain to strips", () => {
    const slots = layout(["quest", "a", "a1", "a2", "a3"]);
    expect(panes(slots).map((slot) => slot.id)).toEqual(["a", "a1", "a2", "a3"]);
    expect(strips(slots)).toEqual([{ depth: 0, id: "quest", kind: "strip", reason: "overflow", width: stripWidth }]);
    expect(slots.reduce((sum, slot) => sum + slot.width, 0)).toBe(wide);
  });

  it("shows fewer panes in a window too narrow for four, folding the earliest to strips", () => {
    const slots = layout(["quest", "a", "a1", "a2"], {}, 1100);
    expect(panes(slots).map((slot) => slot.id)).toEqual(["a1", "a2"]);
    expect(strips(slots).map((slot) => [slot.id, slot.reason])).toEqual([
      ["quest", "narrow"],
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
  it("shows a folded pane as a strip and lets the others share its room equally", () => {
    const slots = layout(["quest", "a", "a1"], { folded: new Set(["a"]) });
    expect(slots.map((slot) => slot.kind)).toEqual(["pane", "strip", "pane"]);
    expect(panes(slots).map((slot) => slot.width)).toEqual([978, 978]);
    expect(strips(slots)[0]).toMatchObject({ reason: "folded", width: stripWidth });
  });

  it("never folds the deepest pane", () => {
    const slots = layout(["quest", "a"], { folded: new Set(["a"]) });
    expect(panes(slots).map((slot) => slot.id)).toEqual(["quest", "a"]);
  });

  it("remembers a fold in the memory and takes it back on unfolding", () => {
    const folded = foldedPane(memory, "a");
    expect([...folded.folded]).toEqual(["a"]);
    expect([...revealedPane(folded, "a").folded]).toEqual([]);
  });

  it("brings a strip back from the overflow by folding the next pane that fits least", () => {
    const chain = ["quest", "a", "a1", "a2", "a3"];
    const slots = layout(chain, revealedPane(memory, "quest"));
    expect(panes(slots).map((slot) => slot.id)).toEqual(["quest", "a1", "a2", "a3"]);
    expect(strips(slots).map((slot) => slot.id)).toEqual(["a"]);
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
  it("allows four panes", () => {
    expect(maxPanes).toBe(4);
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
    expect(slots.map((slot) => slot.width)).toEqual([600, stripWidth, 600]);
  });

  it("forgets the dragged shares, and nothing else", () => {
    const memory = foldedPane(dragged, "a");
    expect(equalizedPanes(memory)).toEqual({ ...memory, weights: [] });
  });
});
