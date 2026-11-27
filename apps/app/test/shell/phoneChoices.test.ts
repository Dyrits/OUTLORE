import { MissionSummary, ThreadSummary, WorkspaceChoice } from "@outlore/contracts";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
  choiceTitleOf,
  creationOf,
  errandChoicesOf,
  questChoicesOf,
  realmChoicesOf,
} from "../../src/shell/phoneChoices";
import { emptySelection } from "../../src/shell/phoneSelection";
import { placementsOf } from "../../src/shell/questTree";

const emptyUsage = { cacheCreation: 0, cacheRead: 0, input: 0, output: 0 };

const mission = (id: string, workspaceId: string | null, title: string, threadCount: number) =>
  Schema.decodeUnknownSync(MissionSummary)({
    budget: { limits: { cost: null, tokens: null }, spent: { cost: 0, tokens: 0 } },
    consumption: {
      earlierTurns: 0,
      estimated: 0,
      reported: 0,
      tokens: emptyUsage,
      turns: 0,
      unpricedTurns: 0,
    },
    harness: "claude",
    id,
    isEmpty: false,
    isTitleByUser: false,
    lastActivityAt: 0,
    lastExchange: { owner: null, reply: null },
    model: "default",
    prompt: null,
    ritual: null,
    runningCount: 0,
    state: "Resting",
    threadCount,
    title,
    topThreadId: `${id}-top`,
    usage: emptyUsage,
    workspaceId,
    workspaceName: null,
  });
const workspace = (id: string, name: string) => Schema.decodeUnknownSync(WorkspaceChoice)({ id, name, path: null });
const thread = (id: string, parentId: string | null, lastActivityAt = 0) =>
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
    shownState: "Underway",
    state: "Underway",
    title: id,
    waitingCount: 0,
  });

const placements = placementsOf(
  [mission("a", "one", "Alpha", 3), mission("b", "one", "Beta", 1), mission("c", null, "Gamma", 2)],
  [workspace("one", "One"), workspace("two", "Two")],
);

describe("listing realms in the sheet", () => {
  it("lists the realms in order, then the Borderlands, with their quest counts", () => {
    const rows = realmChoicesOf(placements, emptySelection);
    expect(rows.map((row) => [row.name, row.note])).toEqual([
      ["One", "2 quests"],
      ["Two", "0 quests"],
      ["Borderlands", "Quests with no realm · 1 quest"],
    ]);
    expect(rows.map((row) => row.choice)).toEqual([
      { kind: "realm", realm: { id: "one", name: "One" } },
      { kind: "realm", realm: { id: "two", name: "Two" } },
      { kind: "realm", realm: { id: null, name: "Borderlands" } },
    ]);
  });

  it("marks the realm chosen, and the Borderlands when they are", () => {
    expect(
      realmChoicesOf(placements, { ...emptySelection, realm: { id: "two", name: "Two" } }).map((row) => row.isSelected),
    ).toEqual([false, true, false]);
    expect(
      realmChoicesOf(placements, { ...emptySelection, realm: { id: null, name: "Borderlands" } }).map(
        (row) => row.isSelected,
      ),
    ).toEqual([false, false, true]);
  });
});

describe("listing quests in the sheet", () => {
  it("lists the chosen realm's quests with the errands each holds and its state", () => {
    const rows = questChoicesOf(placements, { ...emptySelection, realm: { id: "one", name: "One" } });
    expect(rows.map((row) => [row.name, row.note, row.state])).toEqual([
      ["Alpha", "2 errands", "Resting"],
      ["Beta", "0 errands", "Resting"],
    ]);
  });

  it("lists the Borderlands' quests, and none while no realm is chosen", () => {
    expect(
      questChoicesOf(placements, { ...emptySelection, realm: { id: null, name: "Borderlands" } }).map(
        (row) => row.name,
      ),
    ).toEqual(["Gamma"]);
    expect(questChoicesOf(placements, emptySelection)).toEqual([]);
  });
});

describe("listing errands in the sheet", () => {
  it("lists the quest's errands, newest first, without the quest's own thread", () => {
    const threads = [thread("top", null), thread("old", "top", 1), thread("new", "top", 9)];
    const rows = errandChoicesOf(threads, emptySelection);
    expect(rows.map((row) => [row.name, row.state])).toEqual([
      ["new", "Underway"],
      ["old", "Underway"],
    ]);
  });
});

describe("titling a chooser sheet", () => {
  it("says what it chooses and where", () => {
    const selection = { ...emptySelection, realm: { id: "one", name: "One" } };
    expect(choiceTitleOf("realm", selection, null)).toBe("Choose a realm");
    expect(choiceTitleOf("quest", selection, null)).toBe("Choose a quest in One");
    expect(choiceTitleOf("errand", selection, "Alpha")).toBe("Choose an errand in Alpha");
  });
});

describe("the creation row of a chooser sheet", () => {
  it("names what it makes and where", () => {
    const selection = { ...emptySelection, realm: { id: "one", name: "One" } };
    expect(creationOf("realm", selection, null).name).toBe("New realm");
    expect(creationOf("quest", selection, null)).toEqual({ name: "New quest", note: "In One" });
    expect(creationOf("errand", selection, "Alpha")).toEqual({ name: "New errand", note: "In Alpha" });
  });
});
