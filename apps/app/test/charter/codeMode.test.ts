import { describe, expect, it } from "vitest";
import { codeModeExplanation, codeModeLabel, codeModeStateOf, experimentalLabel } from "../../src/charter/codeMode";
import { initialLocation } from "../../src/shell/location";

describe("Charter's Code Mode wording", () => {
  it("names the switch as the specification does and marks it experimental", () => {
    expect(codeModeLabel).toBe("Code Mode for connectors");
    expect(experimentalLabel).toBe("Experimental");
  });

  it("explains in plain words that it changes nothing visible yet and applies from the next turn", () => {
    expect(codeModeExplanation).toContain("short piece of code");
    expect(codeModeExplanation).toContain("changes nothing you can see");
    expect(codeModeExplanation).toContain("next turn");
  });

  it("says what each state means for a thread", () => {
    expect(codeModeStateOf(true)).toMatch(/^On:/);
    expect(codeModeStateOf(false)).toMatch(/^Off:/);
  });
});

describe("opening on the Charter", () => {
  it("resumes the Charter, which needs no quest or realm selection", () => {
    expect(initialLocation("Charter").place).toBe("Charter");
  });
});
