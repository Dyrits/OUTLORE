import { describe, expect, it } from "vitest";
import { childStatusOf } from "../../src/shell/childNotches";

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
