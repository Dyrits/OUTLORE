import { describe, expect, it } from "vitest";
import { isScheduleValid, isValued } from "../../src/rituals/ritualRules";

describe("what a Ritual's scope and schedule need", () => {
  it("asks for a new value only when renaming or changing a setting", () => {
    expect(isValued("Rename")).toBe(true);
    expect(isValued("ChangeSetting")).toBe(true);
    expect(isValued("Archive")).toBe(false);
  });

  it("accepts an hourly schedule of one to 168 hours", () => {
    expect(isScheduleValid({ _tag: "Hourly", hours: 1 })).toBe(true);
    expect(isScheduleValid({ _tag: "Hourly", hours: 168 })).toBe(true);
    expect(isScheduleValid({ _tag: "Hourly", hours: 169 })).toBe(false);
    expect(isScheduleValid({ _tag: "Hourly", hours: 0 })).toBe(false);
  });

  it("accepts a daily schedule with a valid time", () => {
    expect(isScheduleValid({ _tag: "Daily", time: "07:30" })).toBe(true);
    expect(isScheduleValid({ _tag: "Daily", time: "7:30pm" })).toBe(false);
  });
});
