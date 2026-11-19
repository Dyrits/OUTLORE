import { describe, expect, it } from "vitest";
import { callTextOf, changeCountsOf } from "../../src/conversation/stepLabels";
import { clockOf } from "../../src/foundation/formatting";

describe("describing a reported tool call", () => {
  it("shows its summary, target and time in the existing order", () => {
    expect(callTextOf({ at: 1000, detail: "entries.ts", id: "read", summary: "Read a file" }, 1000)).toBe(
      `Ran · Read a file · entries.ts · ${clockOf(1000)}`,
    );
  });

  it("omits an empty target without an extra separator", () => {
    expect(callTextOf({ at: 1000, detail: "", id: "read", summary: "Read a file" }, 1000)).toBe(
      `Ran · Read a file · ${clockOf(1000)}`,
    );
  });
});

describe("counting a modified file's changed lines", () => {
  it("writes the added and removed counts with a plus and a minus sign", () => {
    expect(changeCountsOf({ added: 3, removed: 1 })).toEqual({ added: "+3", removed: "\u22121" });
  });

  it("writes no counts when the host could not know them", () => {
    expect(changeCountsOf({ added: null, removed: null })).toBeNull();
  });
});
