import { MissionSummary, ThreadSummary } from "@outlore/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { railOutlineOf, threadOutlineOf } from "../../src/shell/railOutline";

const thread = (id: string, parentId: string | null, depth: number) =>
  Schema.decodeUnknownSync(ThreadSummary)({
    depth,
    harness: "claude",
    id,
    isAside: false,
    isOpenedByAgent: false,
    lastActivityAt: 0,
    lastExchange: { owner: null, reply: null },
    model: "default",
    openedAt: 0,
    parentId,
    state: "Idle",
    title: id,
    waitingCount: 0,
  });
const tree = [thread("top", null, 0), thread("parent", "top", 1), thread("child", "parent", 2)];

const usage = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };
const quest = (id: string, state: "Idle" | "Running" = "Idle") =>
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
    runningCount: state === "Running" ? 1 : 0,
    state,
    threadCount: 1,
    title: id,
    topThreadId: "top",
    usage,
    workspaceId: null,
    workspaceName: null,
  });

describe("revealing the rail location", () => {
  it("shows the first five quests and any running quest beyond them by default", () => {
    const quests = ["one", "two", "three", "four", "five", "hidden"].map((id) => quest(id));
    const outline = railOutlineOf(
      { borderlands: [...quests, quest("running", "Running")], realms: [] },
      null,
      new Set(),
    );
    expect(outline.borderlands.map((each) => each.id)).toEqual(["one", "two", "three", "four", "five", "running"]);
  });
  it("reveals the selected thread through folded ancestors without changing stored folds", () => {
    const collapsed = new Set(["parent"]);
    const outline = threadOutlineOf(tree, collapsed, tree[2]?.id ?? null, true);
    expect(outline.rows.map((row) => row.thread.id)).toEqual(["parent", "child"]);
    expect(collapsed.has("parent")).toBe(true);
    expect(threadOutlineOf(tree, collapsed, null, true).rows.map((row) => row.thread.id)).toEqual(["parent"]);
  });
  it("keeps the selected quest past the normal placement limit without changing its fold", () => {
    const quests = ["first", "second", "selected"].map((id) => quest(id));
    const outline = railOutlineOf({ borderlands: quests, realms: [] }, "selected", new Set(), 1);
    expect(outline.borderlands.map((each) => each.id)).toEqual(["first", "selected"]);
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
  it("keeps every running quest past the normal placement limit, in its place in the list", () => {
    const quests = [quest("first"), quest("second"), quest("running", "Running"), quest("fourth", "Running")];
    const outline = railOutlineOf({ borderlands: quests, realms: [] }, null, new Set(), 1);
    expect(outline.borderlands.map((each) => each.id)).toEqual(["first", "running", "fourth"]);
  });
});
