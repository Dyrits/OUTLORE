import type { BudgetPeriod, DayText, RitualSchedule } from "@outlore/contracts";
import { hourMillis } from "./settings.ts";

// The computer's local calendar, which every day, period and schedule of the service is read in (budget-control, rituals).
// Dates are built from local fields, never by adding 24 hours, so a change of clock for daylight saving moves neither a
// midnight nor a time of day. Pure: callers pass the moment, so a test pins any day.

/** The local midnight that starts the day holding `at`. */
export const dayStartOf = (at: number) => {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** The day holding `at` as `YYYY-MM-DD`, which sorts as the days do. */
export const dayKeyOf = (at: number | Date): DayText => {
  const date = new Date(at);
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

/** The local midnight a day text names, or null when it is no real date: `2026-02-30` is not rolled over into March. */
export const dayStartOfKey = (text: string) => {
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year ?? 0, (month ?? 0) - 1, day ?? 0);
  return dayKeyOf(date) === text ? date.getTime() : null;
};

/** The midnight `days` after the one at `dayStart`, counted on the calendar so a change of clock does not shift it. */
export const shiftDays = (dayStart: number, days: number) => {
  const date = new Date(dayStart);
  date.setDate(date.getDate() + days);
  return date.getTime();
};

const startShifts = {
  Day: () => void 0,
  Month: (date: Date) => {
    date.setDate(1);
  },
  Week: (date: Date) => {
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  },
} satisfies Record<BudgetPeriod, (date: Date) => void>;

const nextShifts = {
  Day: (date: Date) => date.setDate(date.getDate() + 1),
  Month: (date: Date) => date.setMonth(date.getMonth() + 1),
  Week: (date: Date) => date.setDate(date.getDate() + 7),
} satisfies Record<BudgetPeriod, (date: Date) => void>;

/** When the period holding `now` started: local midnight, on Monday for a week, on the 1st for a month. */
export const periodStartOf = (now: number, period: BudgetPeriod) => {
  const date = new Date(dayStartOf(now));
  startShifts[period](date);
  return date.getTime();
};

/** When the period holding `now` starts over. */
export const nextStartOf = (now: number, period: BudgetPeriod) => {
  const date = new Date(periodStartOf(now, period));
  nextShifts[period](date);
  return date.getTime();
};

/** The furthest ahead a day-based schedule looks for its next day: a month's day (28) always occurs within it. */
const searchDays = 62;

/** The days of the week a day-based schedule allows, Sunday as 0; null for any day. */
const weekdaysOf = (schedule: Exclude<RitualSchedule, { _tag: "Hourly" }>): ReadonlyArray<number> | null =>
  schedule._tag === "Weekdays" ? [1, 2, 3, 4, 5] : schedule._tag === "Weekly" ? [schedule.day] : null;

/** The first moment strictly after `after` at which the schedule is due. */
export const nextRunAfter = (schedule: RitualSchedule, after: number): number => {
  if (schedule._tag === "Hourly") return after + schedule.hours * hourMillis;
  const [hour = 0, minute = 0] = schedule.time.split(":").map(Number);
  const weekdays = weekdaysOf(schedule);
  const start = new Date(after);
  for (let offset = 0; offset <= searchDays; offset++) {
    // Built from local fields so a change of clock for daylight saving keeps the time of day.
    const candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset, hour, minute, 0, 0);
    const isDay =
      (weekdays === null || weekdays.includes(candidate.getDay())) &&
      (schedule._tag !== "Monthly" || candidate.getDate() === schedule.day);
    if (isDay && candidate.getTime() > after) return candidate.getTime();
  }
  // Unreachable: every schedule has a day within the search.
  return after + 24 * hourMillis;
};
