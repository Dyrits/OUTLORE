import { describe, expect, it } from "vitest";
import { questStateOf, rolledUpStateOf, shownStatesOf, threadStatesOf } from "../../src/work/missionStates.ts";

describe("rolling a status up through a tree", () => {
  it("shows Failed when it or a thread beneath it failed, before anything else", () => {
    expect(rolledUpStateOf("Resting", ["Attention", "Failed"])).toBe("Failed");
    expect(rolledUpStateOf("Failed", ["Attention"])).toBe("Failed");
  });

  it("shows Attention when it or a thread beneath it needs the owner and nothing failed", () => {
    expect(rolledUpStateOf("Underway", ["Attention", "Underway"])).toBe("Attention");
    expect(rolledUpStateOf("Attention", ["Underway"])).toBe("Attention");
  });

  it("shows Waiting for a resting or waiting thread with work underway or waiting beneath it", () => {
    expect(rolledUpStateOf("Resting", ["Underway"])).toBe("Waiting");
    expect(rolledUpStateOf("Waiting", ["Waiting"])).toBe("Waiting");
  });

  it("keeps its own status when it is not resting or waiting, or nothing beneath it works", () => {
    expect(rolledUpStateOf("Underway", ["Underway"])).toBe("Underway");
    expect(rolledUpStateOf("Resting", ["Resting", "Stopped", "Fulfilled"])).toBe("Resting");
    expect(rolledUpStateOf("Waiting", [])).toBe("Waiting");
    expect(rolledUpStateOf("Stopped", ["Underway"])).toBe("Stopped");
  });

  it("rolls each thread of a tree up with its own descendants only, leaving archived ones out", () => {
    const shown = shownStatesOf([
      { id: "top", isArchived: false, parentId: null, state: "Resting" },
      { id: "left", isArchived: false, parentId: "top", state: "Resting" },
      { id: "deep", isArchived: false, parentId: "left", state: "Failed" },
      { id: "right", isArchived: false, parentId: "top", state: "Underway" },
      { id: "gone", isArchived: true, parentId: "right", state: "Attention" },
    ]);
    expect(shown.get("top")).toBe("Failed");
    expect(shown.get("left")).toBe("Failed");
    expect(shown.get("deep")).toBe("Failed");
    expect(shown.get("right")).toBe("Underway");
  });
});

describe("a quest's status", () => {
  it("is Fresh while it holds nothing", () => {
    expect(questStateOf("Resting", [], true)).toBe("Fresh");
  });

  it("takes its top thread rolled up over the rest of the tree", () => {
    expect(questStateOf("Resting", ["Underway"], false)).toBe("Waiting");
    expect(questStateOf("Underway", ["Attention"], false)).toBe("Attention");
  });

  it("stays Resting when its top thread reported, for the owner to mark it done", () => {
    expect(questStateOf("Fulfilled", [], false)).toBe("Resting");
  });

  it("reads thread states from a column and leaves out a value no state writes", () => {
    expect(threadStatesOf("Resting,Idle,Underway")).toEqual(["Resting", "Underway"]);
    expect(threadStatesOf(null)).toEqual([]);
  });
});
