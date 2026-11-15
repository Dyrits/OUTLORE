import { describe, expect, it } from "vitest";
import { isCompanionInScope, isCompanionOffered } from "../../src/shell/companionScope";

describe("scoping the Companions tab", () => {
  it("offers only Chronicler's picker when Chronicler fills the panel", () => {
    expect(isCompanionInScope(true, true)).toBe(true);
    expect(isCompanionInScope(false, true)).toBe(false);
  });

  it("offers both pickers when Chronicler is docked", () => {
    expect(isCompanionInScope(true, false)).toBe(true);
    expect(isCompanionInScope(false, false)).toBe(true);
  });

  it("offers Chronicler's Companion only while Chronicler is open, and a page's own whether or not it is", () => {
    expect(isCompanionOffered(true, false, true)).toBe(true);
    expect(isCompanionOffered(true, false, false)).toBe(false);
    expect(isCompanionOffered(false, false, false)).toBe(true);
    expect(isCompanionOffered(false, true, true)).toBe(false);
    expect(isCompanionOffered(true, true, true)).toBe(true);
  });
});
