import type { PlanLimitWindow } from "@outlore/contracts";
import { meterLevelOf } from "../foundation/labels";

/** How a limit stands: green until 80% used, orange from 80%, red at 100%, or hollow while it has not started. */
export type RowLevel = "normal" | "warning" | "reached" | "unstarted";

/** What a provider's one dot shows: its tightest limit's state, or neutral when no limit is known. */
export type DotLevel = "normal" | "warning" | "reached" | "neutral";

/** One limit as a row of the popup's table. */
export type UsageRow = {
  readonly leftPercent: number;
  readonly level: RowLevel;
  /** The limit's own name inside its group, for example "Weekly". */
  readonly name: string;
  /** When it starts over in words, "reset" once it has, or "not started". */
  readonly resetText: string;
};

/** The limits of one model group, such as "Gemini Models"; the name is null for limits that belong to no group. */
export type UsageGroup = { readonly name: string | null; readonly rows: readonly UsageRow[] };

/** A plan's usage as the rail and the popup show it: one dot for the provider, and the table grouped by model group. */
export type PlanUsage = { readonly groups: readonly UsageGroup[]; readonly level: DotLevel };

/**
 * A reading's windows as they stand at `now`: a window whose reset time has passed has started over, so it reads as
 * unused until the next reading says otherwise. A limit that has not started has no reset time (zero) and is kept.
 */
export const currentWindowsOf = (windows: readonly PlanLimitWindow[], now: number): PlanLimitWindow[] =>
  windows.map((window) => (window.resetsAt > 0 && window.resetsAt <= now ? { ...window, usedPercent: 0 } : window));

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

/** How long until a window starts over, in its two largest units, for example "4h 57m" or "6d 9h"; "reset" once it has. */
export const resetsInTextOf = (millis: number): string => {
  if (millis <= 0) return "reset";
  if (millis >= day) return `${Math.floor(millis / day)}d ${Math.floor((millis % day) / hour)}h`;
  if (millis >= hour) return `${Math.floor(millis / hour)}h ${Math.floor((millis % hour) / minute)}m`;
  return `${Math.max(1, Math.floor(millis / minute))}m`;
};

/** What a window has left, from 0 to 100 percent; a used share outside 0 to 100 is kept inside. */
export const leftPercentOf = (window: PlanLimitWindow): number =>
  Math.round(100 - Math.min(100, Math.max(0, window.usedPercent)));

const groupSeparator = " · ";
const severity: Record<DotLevel, number> = { neutral: 0, normal: 1, reached: 3, warning: 2 };

/** A limit named "Gemini Models · Weekly" belongs to the group "Gemini Models" and is called "Weekly" inside it. */
const splitLabelOf = (label: string): { group: string | null; name: string } => {
  const at = label.indexOf(groupSeparator);
  return at < 0
    ? { group: null, name: label }
    : { group: label.slice(0, at), name: label.slice(at + groupSeparator.length) };
};

/**
 * A plan's windows at `now` as the popup's table and the rail's dot: the limits grouped by model group in the order
 * the harness gave them (the shorter window first inside a group), each with what is left and when it starts over; a
 * limit with no reset time has not started and says so. The dot takes the tightest limit's state; limits that have
 * not started never color it, and none known at all leaves it neutral.
 */
export const planUsageOf = (windows: readonly PlanLimitWindow[], now: number): PlanUsage => {
  const grouped = new Map<string | null, { name: string; window: PlanLimitWindow }[]>();
  for (const window of currentWindowsOf(windows, now)) {
    const { group, name } = splitLabelOf(window.label);
    grouped.set(group, [...(grouped.get(group) ?? []), { name, window }]);
  }
  let level: DotLevel = windows.length === 0 ? "neutral" : "normal";
  const groups = [...grouped].map(([name, members]): UsageGroup => {
    const shortestFirst = [...members].sort(
      (current, next) => (current.window.windowMinutes ?? 0) - (next.window.windowMinutes ?? 0),
    );
    return {
      name,
      rows: shortestFirst.map(({ name: limit, window }): UsageRow => {
        const isUnstarted = window.resetsAt <= 0;
        const rowLevel: RowLevel = isUnstarted ? "unstarted" : meterLevelOf(window.usedPercent, 100);
        if (rowLevel !== "unstarted" && severity[rowLevel] > severity[level]) level = rowLevel;
        return {
          leftPercent: leftPercentOf(window),
          level: rowLevel,
          name: limit,
          resetText: isUnstarted ? "not started" : resetsInTextOf(window.resetsAt - now),
        };
      }),
    };
  });
  return { groups, level };
};
