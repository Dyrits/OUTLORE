import { ThreadSummary } from "@outlore/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  ancestorIdsOf,
  childErrandsOf,
  errandPreviewOf,
  errandRowsOf,
  listedErrandsOf,
  rankedFoldedOf,
} from "../../src/conversation/errandRoster";

const thread = (id: string, parentId: string | null, lastActivityAt = 0, extra: Partial<ThreadSummary> = {}) =>
  Schema.decodeUnknownSync(ThreadSummary)({
    depth: parentId === null ? 0 : 1,
    harness: "claude",
    id,
    isAside: false,
    isOpenedByAgent: false,
    lastActivityAt,
    lastExchange: { owner: null, reply: null },
    model: "default",
    openedAt: 0,
    parentId,
    shownState: "Resting",
    state: "Resting",
    title: id,
    waitingCount: 0,
    ...extra,
  });
const none = new Set<string>();

// Siblings of unequal state and activity: the Failed errand is the oldest and the Resting one the newest, so the
// sidebar's rule (latest activity, CHG-0679) and an urgency rule (Failed first) give opposite orders.
const unequal = [
  thread("top", null),
  thread("failed", "top", 1, { shownState: "Failed", state: "Failed" }),
  thread("attention", "top", 5, { shownState: "Attention", state: "Attention" }),
  thread("resting", "top", 9),
  thread("underway", "top", 3, { shownState: "Underway", state: "Underway" }),
];
const idsOf = (rows: ReadonlyArray<{ thread: { id: string } } | { id: string }>) =>
  rows.map((row) => ("thread" in row ? row.thread.id : row.id));
const sidebarOrder = ["resting", "attention", "underway", "failed"];

describe("one order for a parent's errands, wherever they are listed", () => {
  it("ranks the sidebar rows by latest activity, whatever the state", () => {
    expect(idsOf(errandRowsOf(unequal, { collapsed: none, shouldShowAgentThreads: true }))).toEqual(sidebarOrder);
  });

  it("gives the Errands tab the sidebar's order", () => {
    expect(idsOf(childErrandsOf(unequal, "top" as never))).toEqual(sidebarOrder);
  });

  it("gives the thread tree and the starter's switch menu the sidebar's order", () => {
    expect(idsOf(rankedFoldedOf(unequal, true))).toEqual(["top", ...sidebarOrder]);
    expect(idsOf(listedErrandsOf(unequal))).toEqual(sidebarOrder);
  });

  it("ranks the errands beneath each errand by the same rule", () => {
    const nested = [
      thread("top", null),
      thread("old", "top", 1),
      thread("old child new", "old", 8),
      thread("old child old", "old", 2),
      thread("new", "top", 9),
    ];
    expect(idsOf(listedErrandsOf(nested))).toEqual(["new", "old", "old child new", "old child old"]);
  });
});

describe("which errands show", () => {
  it("leaves archived errands out of the tab, the tree and the starter's menu", () => {
    const archived = [...unequal, thread("gone", "top", 99, { isArchived: true })];
    expect(idsOf(childErrandsOf(archived, "top" as never))).toEqual(sidebarOrder);
    expect(idsOf(listedErrandsOf(archived))).toEqual(sidebarOrder);
  });

  it("lists only the direct errands of the parent in the tab", () => {
    const nested = [...unequal, thread("grandchild", "failed", 50)];
    expect(idsOf(childErrandsOf(nested, "top" as never))).toEqual(sidebarOrder);
    expect(idsOf(childErrandsOf(nested, "failed" as never))).toEqual(["grandchild"]);
  });

  it("folds agent-opened errands into their opener unless urgent, then ranks what stays", () => {
    const agents = [
      thread("top", null),
      thread("owner", "top", 1),
      thread("agent", "owner", 9, { isOpenedByAgent: true }),
      thread("urgent agent", "owner", 2, { isOpenedByAgent: true, shownState: "Attention", state: "Attention" }),
    ];
    const rows = errandRowsOf(agents, { collapsed: none, shouldShowAgentThreads: false });
    expect(rows.map((row) => [row.thread.id, row.foldedCount])).toEqual([
      ["owner", 1],
      ["urgent agent", 0],
    ]);
  });

  it("hides what a collapsed errand holds", () => {
    const rows = errandRowsOf([...unequal, thread("under", "resting", 20)], {
      collapsed: new Set(["resting"]),
      shouldShowAgentThreads: true,
    });
    expect(idsOf(rows)).toEqual(sidebarOrder);
    expect(rows[0]?.hasChildren).toBe(true);
  });
});

describe("the sidebar's preview of a quest's errands", () => {
  it("cuts the ranked rows, and counts them all in the overflow label", () => {
    const preview = errandPreviewOf(unequal, {
      collapsed: none,
      selectedThread: null,
      shouldShowAgentThreads: true,
    });
    expect(idsOf(preview.rows)).toEqual(["resting", "attention"]);
    expect(preview.overflowLabel).toBe("Show 4 errands");
  });

  it("unfolds the path to the selected errand, so it is reachable", () => {
    const deep = [thread("top", null), thread("a", "top", 5), thread("a1", "a", 4), thread("b", "top", 1)];
    const preview = errandPreviewOf(deep, {
      collapsed: new Set(["a"]),
      selectedThread: "a1" as never,
      shouldShowAgentThreads: true,
    });
    expect(idsOf(preview.rows)).toEqual(["a", "a1"]);
    expect(preview.overflowLabel).toBe("Show 3 errands");
    expect(
      errandPreviewOf(deep, { collapsed: new Set(["a"]), selectedThread: null, shouldShowAgentThreads: true }).rows.map(
        (row) => row.thread.id,
      ),
    ).toEqual(["a", "b"]);
  });

  it("shows no overflow label while every row fits", () => {
    const preview = errandPreviewOf([thread("top", null), thread("a", "top")], {
      collapsed: none,
      selectedThread: null,
      shouldShowAgentThreads: true,
    });
    expect(preview.overflowLabel).toBeNull();
  });
});

describe("the path to a thread", () => {
  it("lists its ancestors, nearest first", () => {
    const chain = [thread("top", null), thread("a", "top"), thread("a1", "a")];
    expect(ancestorIdsOf(chain, "a1" as never)).toEqual(["a", "top"]);
    expect(ancestorIdsOf(chain, "top" as never)).toEqual([]);
  });
});
