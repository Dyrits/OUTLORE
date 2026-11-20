import { describe, expect, it } from "vitest";
import { boardColumns, boardOf, isStateShownOn, splitEarlier, trimmedColumns } from "../../src/foundation/boardColumns";

describe("laying missions out on the board", () => {
  it("puts failed missions with those in Attention, since both need the owner", () => {
    const board = boardOf([
      { id: "a", state: "Attention" },
      { id: "f", state: "Failed" },
    ] as const);
    expect(board.Attention.map((mission) => mission.id)).toEqual(["a", "f"]);
  });

  it("keeps waiting missions under Underway, in their order, since a thread beneath is at work", () => {
    const board = boardOf([
      { id: "w", state: "Waiting" },
      { id: "r", state: "Underway" },
    ] as const);
    expect(board.Underway.map((mission) => mission.id)).toEqual(["w", "r"]);
    expect(board.Attention).toEqual([]);
  });

  it("puts resting missions in their own column, apart from those at work", () => {
    const board = boardOf([
      { id: "r", state: "Underway" },
      { id: "i", state: "Resting" },
    ] as const);
    expect(board.Resting.map((mission) => mission.id)).toEqual(["i"]);
    expect(board.Underway.map((mission) => mission.id)).toEqual(["r"]);
  });

  it("orders the columns by what needs the owner first, resting before fulfilled", () => {
    expect(boardColumns).toEqual(["Attention", "Underway", "Resting", "Fulfilled"]);
  });

  it("puts fulfilled missions in the last column", () => {
    expect(boardOf([{ id: "d", state: "Fulfilled" }] as const).Fulfilled.map((mission) => mission.id)).toEqual(["d"]);
  });

  it("names a card's state only when it differs from its column", () => {
    expect(isStateShownOn("Underway", "Underway")).toBe(false);
    expect(isStateShownOn("Resting", "Resting")).toBe(false);
    expect(isStateShownOn("Underway", "Waiting")).toBe(true);
    expect(isStateShownOn("Attention", "Failed")).toBe(true);
  });
});

describe("laying fresh and stopped missions out", () => {
  it("keeps a fresh or stopped mission in the Resting column, since nothing is at work", () => {
    const board = boardOf([
      { id: "n", state: "Fresh" },
      { id: "s", state: "Stopped" },
    ] as const);
    expect(board.Resting.map((mission) => mission.id)).toEqual(["n", "s"]);
  });
});

describe("folding earlier missions away", () => {
  const noon = new Date(2026, 10, 9, 12).getTime();
  const at = (id: string, hour: number, day = 9) => ({ id, lastActivityAt: new Date(2026, 10, day, hour).getTime() });

  it("trims only the columns that grow without end", () => {
    expect(trimmedColumns).toEqual(["Resting", "Fulfilled"]);
  });

  it("shows the missions active today and folds the others, keeping their order", () => {
    const { earlier, shown } = splitEarlier([at("a", 9), at("b", 23, 8), at("c", 0), at("d", 11, 1)], noon, null);
    expect(shown.map((mission) => mission.id)).toEqual(["a", "c"]);
    expect(earlier.map((mission) => mission.id)).toEqual(["b", "d"]);
  });

  it("keeps the mission whose panel is open on view, even if it is earlier", () => {
    const { earlier, shown } = splitEarlier([at("a", 9), at("b", 23, 8)], noon, "b");
    expect(shown.map((mission) => mission.id)).toEqual(["a", "b"]);
    expect(earlier).toEqual([]);
  });
});
