import type { Tier } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { keptRenamed, keptWith, keptWithout, liveDraftsOf, shownStackOf } from "../../src/editors/useDraftStack";

const stack = (model: string, backups: Tier["backups"] = []): Tier => ({
  accountId: null,
  backups,
  effort: "default",
  harness: "claude",
  model,
});

describe("showing the stack of a draft", () => {
  it("shows the saved stack when there is no draft", () => {
    expect(shownStackOf(null, stack("a"))).toEqual(stack("a"));
  });

  it("shows the draft while the saved stack is the one it began from", () => {
    const own = { editedFrom: stack("a"), value: stack("b") };
    expect(shownStackOf(own, stack("a"))).toEqual(stack("b"));
  });

  it("shows the new saved stack once it differs from what the draft began from", () => {
    const own = { editedFrom: stack("a"), value: stack("b") };
    expect(shownStackOf(own, stack("c"))).toEqual(stack("c"));
  });

  it("shows the saved stack after a save made it equal to the draft", () => {
    const own = { editedFrom: stack("a"), value: stack("b") };
    expect(shownStackOf(own, stack("b"))).toEqual(stack("b"));
  });
});

describe("keeping drafts by preset", () => {
  it("keeps an edited stack with the saved one it began from", () => {
    const kept = keptWith({}, "Light", stack("a"), stack("b"));
    expect(kept.Light).toEqual({ editedFrom: stack("a"), value: stack("b") });
  });

  it("drops the draft when an edit returns to the saved stack, so the list stops saying unsaved", () => {
    const kept = keptWith(keptWith({}, "Light", stack("a"), stack("b")), "Light", stack("a"), stack("a"));
    expect(kept).toEqual({});
  });

  it("drops the draft on Discard or save, which report null", () => {
    expect(keptWith(keptWith({}, "Light", stack("a"), stack("b")), "Light", stack("a"), null)).toEqual({});
  });

  it("keeps other presets' drafts when one changes", () => {
    const kept = keptWith(keptWith({}, "Light", stack("a"), stack("b")), "Heavy", stack("x"), stack("y"));
    expect(Object.keys(kept).sort()).toEqual(["Heavy", "Light"]);
  });

  it("lists only the drafts whose preset is still the saved stack they began from", () => {
    const kept = {
      Heavy: { editedFrom: stack("x"), value: stack("y") },
      Light: { editedFrom: stack("a"), value: stack("b") },
    };
    const saved: Record<string, Tier> = { Heavy: stack("changed elsewhere"), Light: stack("a") };
    expect(liveDraftsOf(kept, (key) => saved[key] ?? null)).toEqual({ Light: stack("b") });
  });

  it("lists no draft for a preset that is gone", () => {
    const kept = { Gone: { editedFrom: stack("a"), value: stack("b") } };
    expect(liveDraftsOf(kept, () => null)).toEqual({});
  });
});

describe("keeping drafts through a rename and a delete", () => {
  const drafts = keptWith({}, "Heavy", stack("a"), stack("b"));

  it("moves the draft to the new name when its preset is renamed", () => {
    const renamed = keptRenamed(drafts, "Heavy", "Strong");
    expect(Object.keys(renamed)).toEqual(["Strong"]);
    expect(renamed.Strong?.value).toEqual(stack("b"));
  });

  it("leaves the drafts as they were when the renamed preset had none", () => {
    expect(keptRenamed(drafts, "Light", "Soft")).toBe(drafts);
  });

  it("drops the draft when its preset is deleted", () => {
    expect(keptWithout(drafts, "Heavy")).toEqual({});
  });
});
