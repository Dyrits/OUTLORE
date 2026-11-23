import { MissionSummary, ThreadSummary } from "@outlore/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { placementsOf } from "../../src/shell/questTree";
import { railOutlineOf, threadOutlineOf } from "../../src/shell/railOutline";

const thread = (id: string, parentId: string | null, depth: number, isOpenedByAgent = false) =>
  Schema.decodeUnknownSync(ThreadSummary)({
    depth,
    harness: "claude",
    id,
    isAside: false,
    isOpenedByAgent,
    lastActivityAt: 0,
    lastExchange: { owner: null, reply: null },
    model: "default",
    openedAt: 0,
    parentId,
    shownState: "Resting",
    state: "Resting",
    title: id,
    waitingCount: 0,
  });
const tree = [thread("top", null, 0), thread("parent", "top", 1), thread("child", "parent", 2)];

const usage = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
const quest = (id: string, state: MissionSummary["state"] = "Resting") =>
  Schema.decodeUnknownSync(MissionSummary)({
    budget: { limits: { cost: null, tokens: null }, spent: { cost: 0, tokens: 0 } },
    consumption: { earlierTurns: 0, estimated: 0, reported: 0, tokens: usage, turns: 0, unpricedTurns: 0 },
    harness: "claude",
    id,
    isEmpty: false,
    isTitleByUser: false,
    lastActivityAt: 0,
    lastExchange: { owner: null, reply: null },
    model: "default",
    prompt: null,
    ritual: null,
    runningCount: state === "Underway" ? 1 : 0,
    state,
    threadCount: 1,
    title: id,
    topThreadId: "top",
    usage,
    workspaceId: null,
    workspaceName: null,
  });

describe("revealing the rail location", () => {
  it("fills the preview by status and then recency, including Failed and Attention quests", () => {
    const quests = [
      quest("running", "Underway"),
      quest("older resting"),
      { ...quest("newer resting"), lastActivityAt: 1 },
      quest("attention", "Attention"),
      quest("failed", "Failed"),
    ];
    const outline = railOutlineOf(placementsOf(quests, []), null, new Set());
    expect(outline.borderlands.map((each) => each.id)).toEqual([
      "failed",
      "attention",
      "newer resting",
      "older resting",
    ]);
  });
  it("reveals the selected thread through folded ancestors without changing stored folds", () => {
    const collapsed = new Set(["parent"]);
    const outline = threadOutlineOf(tree, collapsed, tree[2]?.id ?? null, true);
    expect(outline.rows.map((row) => row.thread.id)).toEqual(["parent", "child"]);
    expect(collapsed.has("parent")).toBe(true);
    expect(threadOutlineOf(tree, collapsed, null, true).rows.map((row) => row.thread.id)).toEqual(["parent"]);
  });
  it("keeps the selected quest within the placement limit without changing its fold", () => {
    const quests = ["first", "second", "selected"].map((id) => quest(id));
    const outline = railOutlineOf({ borderlands: quests, realms: [] }, "selected", new Set(), 1);
    expect(outline.borderlands.map((each) => each.id)).toEqual(["selected"]);
    expect(outline.isQuestOpen("selected")).toBe(false);
    expect(outline.isQuestOpen("first")).toBe(false);
  });
  it("keeps the selected quest folded when the owner folds it", () => {
    const outline = railOutlineOf({ borderlands: [quest("selected")], realms: [] }, "selected", new Set());
    expect(outline.isQuestOpen("selected")).toBe(false);
  });
  it("keeps one quest open when another quest is selected", () => {
    const outline = railOutlineOf(
      { borderlands: [quest("first"), quest("second")], realms: [] },
      "second",
      new Set(["first"]),
    );
    expect(outline.isQuestOpen("first")).toBe(true);
    expect(outline.isQuestOpen("second")).toBe(false);
  });
  it("fills the remaining slots in placement order", () => {
    const quests = [quest("first"), quest("second"), quest("running", "Underway"), quest("fourth", "Underway")];
    const outline = railOutlineOf({ borderlands: quests, realms: [] }, "second", new Set(), 2);
    expect(outline.borderlands.map((each) => each.id)).toEqual(["first", "second"]);
  });
});

describe("limiting sidebar errands", () => {
  it("previews the most urgent errands by displayed status even when a hidden opener folds away", () => {
    const threads = [
      ...tree,
      thread("folded", "top", 1, true),
      { ...thread("failed", "folded", 2), shownState: "Failed" as const, state: "Failed" as const },
      { ...thread("attention", "top", 1), shownState: "Attention" as const },
    ];
    const outline = threadOutlineOf(threads, new Set(), null, false);
    expect(outline.rows.map(({ depth, thread }) => [thread.id, depth])).toEqual([
      ["failed", 1],
      ["attention", 1],
    ]);
  });

  it("offers no overflow link for one or two errand rows", () => {
    for (const threads of [tree.slice(0, 2), tree]) {
      const outline = threadOutlineOf(threads, new Set(), null, true);
      expect(outline.rows).toHaveLength(threads.length - 1);
      expect(outline.overflowLabel).toBeNull();
    }
  });

  it("shows two nested rows and offers the full list when an errand is hidden by the limit", () => {
    const threads = [...tree, thread("sibling", "top", 1)];
    const outline = threadOutlineOf(threads, new Set(), null, true);
    expect(outline.rows.map((row) => row.thread.id)).toEqual(["parent", "child"]);
    expect(outline.overflowLabel).toBe("Show 3 errands");
    expect(threadOutlineOf(threads, new Set(["parent"]), null, true).overflowLabel).toBeNull();
  });
});
