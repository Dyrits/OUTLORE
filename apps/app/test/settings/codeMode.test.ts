import { describe, expect, it } from "vitest";
import { codeModeExplanation, codeModeLabel, codeModeStateOf, experimentalLabel } from "../../src/settings/codeMode";

describe("Code Mode wording in Settings", () => {
  it("names the switch as the specification does and marks it experimental", () => {
    expect(codeModeLabel).toBe("Code Mode");
    expect(experimentalLabel).toBe("Experimental");
  });

  it("explains in plain words what it covers and leaves alone, and that it applies from the next turn", () => {
    expect(codeModeExplanation).toContain("short piece of code");
    expect(codeModeExplanation).toContain("Outlore's tools and its connectors' tools");
    expect(codeModeExplanation).toContain("still asks you");
    expect(codeModeExplanation).toContain("commands and file edits are not affected");
    expect(codeModeExplanation).toContain("next turn");
    // Outlore's own tools exist now, so it no longer says that nothing changes yet.
    expect(codeModeExplanation).not.toContain("changes nothing");
  });

  it("says what each state means for a thread", () => {
    expect(codeModeStateOf(true)).toBe("On: a thread writes code to call Outlore's tools and its connectors' tools.");
    expect(codeModeStateOf(false)).toBe("Off: a thread sees each tool and calls it one by one.");
  });
});
