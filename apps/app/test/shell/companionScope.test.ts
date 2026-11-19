import { describe, expect, it } from "vitest";
import { isCompanionOffered } from "../../src/shell/companionScope";

describe("scoping the Companions tab", () => {
  it("offers Chronicler's Companion only while the Chronicle is open, and a page's own whether or not it is", () => {
    expect(isCompanionOffered(true, true)).toBe(true);
    expect(isCompanionOffered(true, false)).toBe(false);
    expect(isCompanionOffered(false, false)).toBe(true);
    expect(isCompanionOffered(false, true)).toBe(true);
  });
});
