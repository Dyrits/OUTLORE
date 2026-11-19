import { describe, expect, it } from "vitest";
import { clockOf, dateOf, stampOf } from "../../src/foundation/formatting";

describe("stamping a message with its date and time", () => {
  const sentAt = new Date(2026, 10, 19, 11, 15).getTime();

  it("shows the date with its year, then the time, joined by a dot", () => {
    expect(stampOf(sentAt)).toBe(`${dateOf(sentAt)} · ${clockOf(sentAt)}`);
  });

  it("includes the year of the message", () => {
    expect(dateOf(sentAt)).toContain("2026");
  });
});
