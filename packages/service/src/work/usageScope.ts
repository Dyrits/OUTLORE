import {
  chroniclerRealmKey,
  type DayText,
  deletedRealmKey,
  maxUsageDays,
  type UsageDimension,
  type UsageFilter,
  type UsagePeriod,
} from "@outlore/contracts";
import { dayKeyOf, dayStartOf, dayStartOfKey, shiftDays } from "../core/index.ts";
import { questKindTextOf } from "./questVisibility.ts";

// What the usage page reads from (budget-control, Reserves usage page): the local calendar days of a period, and the
// SQL that selects the rows of a breakdown. Dates are local to the computer the service runs on, as the owner reads them.

/** The days a read covers: their texts, and the millisecond bounds, the end excluded. */
export type UsageBounds = {
  readonly days: ReadonlyArray<DayText>;
  readonly firstDay: DayText;
  readonly from: number;
  readonly lastDay: DayText;
  readonly to: number;
};

/**
 * The days of a period at time `now`: the last 7 or 30 including today, or a range with both its days included.
 * Null for a range that is no date, runs backwards, or is longer than `maxUsageDays`.
 */
export const boundsOf = (period: UsagePeriod, now: number): UsageBounds | null => {
  const today = dayStartOf(now);
  const first = period._tag === "Days" ? shiftDays(today, 1 - period.days) : dayStartOfKey(period.from);
  const last = period._tag === "Days" ? today : dayStartOfKey(period.to);
  if (first === null || last === null || first > last) return null;
  const days: DayText[] = [];
  for (let day = first; day <= last; day = shiftDays(day, 1)) days.push(dayKeyOf(day));
  if (days.length > maxUsageDays) return null;
  return { days, firstDay: dayKeyOf(first), from: first, lastDay: dayKeyOf(last), to: shiftDays(last, 1) };
};

/** Where a read finds the quest and the time of the rows it counts: the usage rows' own columns, or another table's. */
type KeyColumns = {
  readonly mission: string;
  readonly time: string;
};

/** The usage rows' columns. */
export const usageColumns: KeyColumns = { mission: "u.mission_id", time: "u.ended_at" };

/** A message's columns. */
export const messageColumns: KeyColumns = { mission: "x.mission_id", time: "x.sent_at" };

/** A turn's columns, its quest read through its thread `th`. */
export const turnColumns: KeyColumns = { mission: "th.mission_id", time: "t.ended_at" };

/**
 * The SQL that gives a row its key under a dimension (see `UsageFilter`). The result is spliced into queries as text, so
 * it must stay constant: `dimension` is a closed set decoded at the socket, never a name from the owner. Quests and
 * realms are read through the `mi` (quest), `qt` (its top thread), and `w` (its realm) tables of `questJoinsOf`; a
 * harness, model, or account is only known from usage rows, so a read of other rows never selects by them.
 */
export const keyOf = (dimension: UsageDimension, columns: KeyColumns) => {
  const keys = {
    Account: "CASE WHEN u.harness IS NULL THEN '' ELSE u.harness || '/' || COALESCE(u.account_id, '') END",
    Day: `date(${columns.time} / 1000, 'unixepoch', 'localtime')`,
    Harness: "COALESCE(u.harness, '')",
    Model: "COALESCE(u.model, '')",
    Quest: columns.mission,
    // Chronicler's own quest and quests deleted since they spent are no realm's; a quest in none is in the Borderlands (key empty).
    Realm: `CASE WHEN mi.id IS NULL THEN '${deletedRealmKey}' WHEN ${questKindTextOf("chronicler", "mi")} THEN '${chroniclerRealmKey}' ELSE COALESCE(qt.workspace_id, '') END`,
  } satisfies Record<UsageDimension, string>;
  return keys[dimension];
};

/** The tables that tell a quest's title, kind, and realm from the mission column `mission`. */
export const questJoinsOf = (mission: string) =>
  `LEFT JOIN missions mi ON mi.id = ${mission}
   LEFT JOIN threads qt ON qt.id = mi.top_thread_id
   LEFT JOIN workspaces w ON w.id = qt.workspace_id`;

/** Whether every filter can select rows that are not usage rows: a quest, a realm, or a day tells where a message or a turn belongs. */
export const arePlaceFilters = (filters: ReadonlyArray<UsageFilter>) =>
  filters.every((filter) => filter.dimension === "Realm" || filter.dimension === "Quest" || filter.dimension === "Day");

/**
 * The WHERE of a read over the days of `bounds`, the end excluded, and the filters, one for each dimension (the last
 * wins), with its values to bind in order. `extra` is more constant conditions, which take no value.
 */
export const whereOf = (
  bounds: UsageBounds,
  columns: KeyColumns,
  filters: ReadonlyArray<UsageFilter>,
  extra: ReadonlyArray<string> = [],
) => {
  const chosen = new Map(filters.map((filter) => [filter.dimension, filter.key] as const));
  return {
    params: [bounds.from, bounds.to, ...chosen.values()],
    text: [
      `${columns.time} >= ?`,
      `${columns.time} < ?`,
      ...extra,
      ...[...chosen.keys()].map((dimension) => `${keyOf(dimension, columns)} = ?`),
    ].join(" AND "),
  };
};
