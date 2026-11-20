import { describe, expect, it } from "vitest";
import { type ChildNotch, childNotchesOf, maxChildNotches } from "../../src/shell/childNotches";

const child = (id: string, state: ChildNotch<string>["state"], lastActivityAt = 0, isArchived?: boolean) => ({
  id,
  isArchived,
  lastActivityAt,
  state,
});

describe("the notches of a pane's children", () => {
  it("orders Failed, Attention, Resting, Underway, Waiting, Stopped, then Fresh", () => {
    const { shown, more } = childNotchesOf(
      [
        child("fresh", "Fresh", 99),
        child("stopped", "Stopped", 90),
        child("waiting", "Waiting", 80),
        child("underway", "Underway", 70),
        child("resting", "Resting", 60),
        child("attention", "Attention", 50),
        child("failed", "Failed", 40),
      ],
      new Set(),
    );
    expect(shown.map((each) => each.id)).toEqual(["failed", "attention", "resting", "underway"]);
    expect(more).toEqual({ count: 3, state: "Waiting" });
  });

  it("ranks Waiting after Underway and no longer counts it as the owner's turn", () => {
    const { shown } = childNotchesOf([child("waiting", "Waiting", 9), child("underway", "Underway", 1)], new Set());
    expect(shown.map((each) => each.id)).toEqual(["underway", "waiting"]);
  });

  it("puts the latest activity first among equals", () => {
    const { shown } = childNotchesOf(
      [child("old", "Resting", 1), child("new", "Resting", 9), child("mid", "Resting", 5)],
      new Set(),
    );
    expect(shown.map((each) => each.id)).toEqual(["new", "mid", "old"]);
  });

  it("leaves out what is fulfilled, archived or already visible, and counts none of it", () => {
    const { more, shown } = childNotchesOf(
      [
        child("fulfilled", "Fulfilled"),
        child("archived", "Archived"),
        child("flag", "Resting", 0, true),
        child("open", "Failed"),
        child("kept", "Resting"),
      ],
      new Set(["open"]),
    );
    expect(shown.map((each) => each.id)).toEqual(["kept"]);
    expect(more).toBeNull();
  });

  it("shows four and no more notch when exactly four are left", () => {
    const children = Array.from({ length: maxChildNotches }, (_, index) => child(`c${index}`, "Resting", index));
    const { more, shown } = childNotchesOf(children, new Set());
    expect(shown).toHaveLength(maxChildNotches);
    expect(more).toBeNull();
  });

  it("keeps the four most urgent and sums the rest, with the most urgent state among them", () => {
    const { more, shown } = childNotchesOf(
      [
        child("f1", "Failed", 1),
        child("f2", "Failed", 2),
        child("s1", "Attention", 3),
        child("s2", "Attention", 4),
        child("w", "Waiting", 5),
        child("i1", "Stopped", 9),
        child("i2", "Underway", 8),
      ],
      new Set(),
    );
    expect(shown.map((each) => each.id)).toEqual(["f2", "f1", "s2", "s1"]);
    expect(more).toEqual({ count: 3, state: "Underway" });
  });

  it("has nothing to show for no children", () => {
    expect(childNotchesOf([], new Set())).toEqual({ more: null, shown: [] });
  });
});
