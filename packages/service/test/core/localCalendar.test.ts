import { describe, expect, it } from "vitest";
import {
  dayKeyOf,
  dayStartOf,
  dayStartOfKey,
  nextRunAfter,
  nextStartOf,
  periodStartOf,
  shiftDays,
} from "../../src/core/localCalendar.ts";

// The calendar is the computer's local one, so these cases run in a zone that changes its clock: Paris springs forward on
// 2026-03-29 (02:00 becomes 03:00, a day of 23 hours) and falls back on 2026-10-25 (03:00 becomes 02:00, a day of 25).
process.env.TZ = "Europe/Paris";

const hour = 60 * 60 * 1000;
const local = (month: number, day: number, hours = 0, minutes = 0, seconds = 0, millis = 0) =>
  new Date(2026, month - 1, day, hours, minutes, seconds, millis).getTime();

it("runs in a zone with daylight saving, or the cases below would prove nothing", () => {
  expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(-60);
  expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(-120);
  expect(local(3, 30) - local(3, 29)).toBe(23 * hour);
  expect(local(10, 26) - local(10, 25)).toBe(25 * hour);
});

describe("a local day", () => {
  it("starts at local midnight, on a day of 23 or 25 hours as on any other", () => {
    expect(dayStartOf(local(3, 29, 15, 30))).toBe(local(3, 29));
    expect(dayStartOf(local(10, 25, 15, 30))).toBe(local(10, 25));
    expect(dayStartOf(local(11, 6, 0, 0, 0, 0))).toBe(local(11, 6));
    expect(dayStartOf(local(11, 6, 23, 59, 59, 999))).toBe(local(11, 6));
  });

  it("changes at midnight to the millisecond", () => {
    expect(dayKeyOf(local(11, 6, 23, 59, 59, 999))).toBe("2026-11-06");
    expect(dayKeyOf(local(11, 7, 0, 0, 0, 0))).toBe("2026-11-07");
    expect(dayKeyOf(local(12, 31, 23, 59, 59, 999))).toBe("2026-12-31");
    expect(dayKeyOf(local(12, 31, 23, 59, 59, 999) + 1)).toBe("2027-01-01");
  });

  it("keeps one key across the hour a clock repeats, so a day is counted once", () => {
    const first = Date.UTC(2026, 9, 25, 0, 30);
    expect(dayKeyOf(first)).toBe("2026-10-25");
    expect(dayKeyOf(first + hour)).toBe("2026-10-25");
  });

  it("is read from a date as from a moment", () => {
    expect(dayKeyOf(new Date(2026, 0, 5, 12))).toBe(dayKeyOf(local(1, 5, 12)));
  });

  it("is named by a key that is a real date, and by none other", () => {
    expect(dayStartOfKey("2026-03-29")).toBe(local(3, 29));
    expect(dayStartOfKey("2026-02-30")).toBeNull();
    expect(dayStartOfKey("2026-13-01")).toBeNull();
  });

  it("is shifted on the calendar, not by 24 hours, across a change of clock", () => {
    expect(shiftDays(local(3, 29), 1)).toBe(local(3, 30));
    expect(shiftDays(local(10, 25), 1)).toBe(local(10, 26));
    expect(shiftDays(local(3, 30), -1)).toBe(local(3, 29));
    expect(shiftDays(local(1, 1), -1)).toBe(local(1, 1) - 24 * hour);
  });
});

describe("a budget period", () => {
  it("starts at local midnight, on Monday for a week, and on the 1st for a month", () => {
    const friday = local(11, 6, 15, 30);
    const sunday = local(11, 8, 23, 59);
    expect(periodStartOf(friday, "Day")).toBe(local(11, 6));
    expect(periodStartOf(friday, "Week")).toBe(local(11, 2));
    expect(periodStartOf(sunday, "Week")).toBe(local(11, 2));
    expect(periodStartOf(friday, "Month")).toBe(local(11, 1));
  });

  it("starts over at the next local midnight, Monday or 1st, whatever a day's length", () => {
    expect(nextStartOf(local(3, 28, 12), "Day")).toBe(local(3, 29));
    expect(nextStartOf(local(3, 29, 12), "Day")).toBe(local(3, 30));
    expect(nextStartOf(local(10, 25, 12), "Day")).toBe(local(10, 26));
    expect(nextStartOf(local(11, 6, 23, 59, 59, 999), "Day")).toBe(local(11, 7));
    expect(nextStartOf(local(11, 7), "Day")).toBe(local(11, 8));
    expect(nextStartOf(local(3, 25, 12), "Week")).toBe(local(3, 30));
    expect(nextStartOf(local(10, 22, 12), "Week")).toBe(local(10, 26));
    expect(nextStartOf(local(11, 15, 12), "Month")).toBe(local(12, 1));
    expect(nextStartOf(local(12, 15, 12), "Month")).toBe(new Date(2027, 0, 1).getTime());
  });

  it("starts a week that crosses a change of clock on its Monday", () => {
    expect(periodStartOf(local(3, 29, 23), "Week")).toBe(local(3, 23));
    expect(periodStartOf(local(10, 25, 23), "Week")).toBe(local(10, 19));
  });
});

describe("the next run of a Ritual's schedule", () => {
  it("runs a daily Ritual later the same day, or the next day once the time has passed", () => {
    const schedule = { _tag: "Daily", time: "07:00" } as const;
    expect(nextRunAfter(schedule, local(11, 10, 6, 0))).toBe(local(11, 10, 7, 0));
    expect(nextRunAfter(schedule, local(11, 10, 7, 0))).toBe(local(11, 11, 7, 0));
  });

  it("runs a daily Ritual at midnight on the next midnight, to the millisecond", () => {
    const schedule = { _tag: "Daily", time: "00:00" } as const;
    expect(nextRunAfter(schedule, local(11, 10, 23, 59, 59, 999))).toBe(local(11, 11));
    expect(nextRunAfter(schedule, local(11, 11))).toBe(local(11, 12));
  });

  it("keeps the time of day on the days the clock changes, so the run is 22 or 26 hours after the last", () => {
    const schedule = { _tag: "Daily", time: "07:00" } as const;
    expect(nextRunAfter(schedule, local(3, 28, 7))).toBe(local(3, 29, 7));
    expect(local(3, 29, 7) - local(3, 28, 7)).toBe(23 * hour);
    expect(nextRunAfter(schedule, local(10, 24, 7))).toBe(local(10, 25, 7));
    expect(local(10, 25, 7) - local(10, 24, 7)).toBe(25 * hour);
  });

  it("runs a Ritual set inside the hour a clock skips just after it, once that day", () => {
    const schedule = { _tag: "Daily", time: "02:30" } as const;
    const skipped = nextRunAfter(schedule, local(3, 28, 12));
    expect(skipped).toBe(local(3, 29, 3, 30));
    expect(nextRunAfter(schedule, skipped)).toBe(local(3, 30, 2, 30));
  });

  it("runs a Ritual set inside the hour a clock repeats at its first pass only", () => {
    const schedule = { _tag: "Daily", time: "02:30" } as const;
    const first = nextRunAfter(schedule, local(10, 24, 12));
    expect(first).toBe(Date.UTC(2026, 9, 25, 0, 30));
    expect(nextRunAfter(schedule, first)).toBe(local(10, 26, 2, 30));
  });

  it("skips the weekend for a weekdays Ritual", () => {
    // 2026-11-13 is a Friday.
    expect(nextRunAfter({ _tag: "Weekdays", time: "09:30" }, local(11, 13, 10, 0))).toBe(local(11, 16, 9, 30));
  });

  it("runs a weekly Ritual on its day, Sunday being 0", () => {
    // 2026-11-10 is a Tuesday; the Sunday after is the 15th.
    expect(nextRunAfter({ _tag: "Weekly", day: 0, time: "08:00" }, local(11, 10, 12, 0))).toBe(local(11, 15, 8, 0));
  });

  it("runs a monthly Ritual on its day of the next month once this month's has passed", () => {
    expect(nextRunAfter({ _tag: "Monthly", day: 28, time: "12:00" }, local(11, 29, 0, 0))).toBe(local(12, 28, 12, 0));
    expect(nextRunAfter({ _tag: "Monthly", day: 28, time: "12:00" }, local(11, 10, 0, 0))).toBe(local(11, 28, 12, 0));
  });

  it("runs an hourly Ritual that many hours after the moment given, counted in elapsed hours", () => {
    expect(nextRunAfter({ _tag: "Hourly", hours: 6 }, local(11, 10, 6, 15))).toBe(local(11, 10, 12, 15));
    expect(nextRunAfter({ _tag: "Hourly", hours: 6 }, local(3, 29, 0, 0))).toBe(local(3, 29, 0, 0) + 6 * hour);
  });
});
