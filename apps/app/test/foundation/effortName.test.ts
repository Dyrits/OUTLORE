import { describe, expect, it } from "vitest";
import { effortLabel, effortName } from "../../src/foundation/formatting";

describe("effortName", () => {
  it("title-cases each provider level, with XHigh keeping its inner capital", () => {
    expect(effortName("default")).toBe("Default");
    expect(effortName("low")).toBe("Low");
    expect(effortName("medium")).toBe("Medium");
    expect(effortName("high")).toBe("High");
    expect(effortName("xhigh")).toBe("XHigh");
    expect(effortName("max")).toBe("Max");
  });

  it("keeps the owner's wording for the model's own effort", () => {
    expect(effortLabel("default")).toBe("Default effort");
    expect(effortLabel("high")).toBe("High");
  });
});
