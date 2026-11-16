import { describe, expect, it } from "@effect/vitest";
import { periodStartOf } from "../../src/core/spending.ts";

describe("the global budget's period", () => {
  it("starts at local midnight, on Monday for a week, and on the 1st for a month", () => {
    const friday = new Date(2026, 10, 6, 15, 30).getTime();
    const sunday = new Date(2026, 10, 8, 23, 59).getTime();
    expect(periodStartOf(friday, "Day")).toBe(new Date(2026, 10, 6).getTime());
    expect(periodStartOf(friday, "Week")).toBe(new Date(2026, 10, 2).getTime());
    expect(periodStartOf(sunday, "Week")).toBe(new Date(2026, 10, 2).getTime());
    expect(periodStartOf(friday, "Month")).toBe(new Date(2026, 10, 1).getTime());
  });
});
