import { describe, expect, it } from "vitest";
import { displayIdOf, nameWithId } from "../../src/foundation/displayId";

describe("displayIdOf", () => {
  it("takes the first six hexadecimal characters of the id, in capitals", () => {
    expect(displayIdOf("quest", "0f3a9c21-77aa-4b2e-9d10-aabbccddeeff")).toBe("[Q-0F3A9C]");
    expect(displayIdOf("errand", "1d4e5f00-77aa-4b2e-9d10-aabbccddeeff")).toBe("[E-1D4E5F]");
  });

  it("puts the id before the name", () => {
    expect(nameWithId("quest", "0f3a9c21-77aa-4b2e-9d10-aabbccddeeff", "Quest")).toBe("[Q-0F3A9C] Quest");
  });
});
