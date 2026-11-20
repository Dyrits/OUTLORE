// Which of a quest's errands, or a realm's quests, get a notch on their parent's pane edge, and in what order. The window
// only draws what this returns, so it runs in plain Node.

import type { MissionState, ThreadState } from "@outlore/contracts";

/** The most child notches shown; the rest become one "+N" notch. */
export const maxChildNotches = 4;

/** What a child needs to be ranked: an errand's summary or a quest's. */
export type ChildNotch<Id extends string> = {
  id: Id;
  /** Whether the owner archived it. */
  isArchived?: boolean | undefined;
  lastActivityAt: number;
  state: ThreadState | MissionState;
};

/** The states of active work, most urgent first (mission-tracking, Mission state; CHG-0599). Fulfilled and Archived have no notch. */
const urgency = {
  Archived: null,
  Attention: 1,
  Failed: 0,
  Fresh: 6,
  Fulfilled: null,
  Resting: 2,
  Stopped: 5,
  Underway: 3,
  Waiting: 4,
} as const satisfies Record<ThreadState | MissionState, number | null>;

/** How urgent a state is, 0 being the most urgent; null for work that is over, which has no notch. */
export const urgencyOf = (state: ThreadState | MissionState): number | null => urgency[state];

/** A child that is over or archived has no notch. */
const isActive = (child: ChildNotch<string>): boolean => urgencyOf(child.state) !== null && child.isArchived !== true;

/**
 * The notches of the active children that are not in `visible` (already open in a pane, or a notch of their own), the
 * four most urgent first and what is left as a count with the state of the most urgent child it holds. Equal urgency
 * puts the latest activity first.
 */
export const childNotchesOf = <Id extends string>(
  children: ReadonlyArray<ChildNotch<Id>>,
  visible: ReadonlySet<string>,
): { more: { count: number; state: ThreadState | MissionState } | null; shown: Array<ChildNotch<Id>> } => {
  const ranked = children
    .filter((child) => isActive(child) && !visible.has(child.id))
    .sort(
      (current, next) =>
        (urgencyOf(current.state) ?? 0) - (urgencyOf(next.state) ?? 0) ||
        next.lastActivityAt - current.lastActivityAt ||
        current.id.localeCompare(next.id),
    );
  const hidden = ranked.slice(maxChildNotches);
  const first = hidden[0];
  return {
    more: first === undefined ? null : { count: hidden.length, state: first.state },
    shown: ranked.slice(0, maxChildNotches),
  };
};
