import { describe, expect, it } from "vitest";
import { childStatusOf, compareUrgency } from "../../src/shell/childNotches";

describe("child notch status", () => {
  it("shows the highest urgency across all active children", () => {
    expect(
      childStatusOf([{ state: "Resting" }, { state: "Waiting" }, { state: "Failed" }, { state: "Attention" }]),
    ).toBe("Failed");
  });

  it("ignores archived and finished children", () => {
    expect(childStatusOf([{ isArchived: true, state: "Failed" }, { state: "Fulfilled" }])).toBeNull();
    expect(childStatusOf([])).toBeNull();
  });
});

describe("ordering work by urgency", () => {
  it("puts the most urgent first and breaks ties by latest activity", () => {
    const work = [
      { lastActivityAt: 9, state: "Fulfilled" },
      { lastActivityAt: 8, state: "Waiting" },
      { lastActivityAt: 1, state: "Underway" },
      { lastActivityAt: 2, state: "Attention" },
      { lastActivityAt: 3, state: "Attention" },
    ] as const;
    expect([...work].sort(compareUrgency).map(({ lastActivityAt }) => lastActivityAt)).toEqual([3, 2, 1, 8, 9]);
  });
});
