import type { MissionState, ThreadState } from "@outlore/contracts";

/** The states of active work, most urgent first (mission-tracking, Mission state; CHG-0599). Fulfilled and Archived have no urgency. */
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

/** How urgent a state is, 0 being the most urgent; null for work that is over. */
export const urgencyOf = (state: ThreadState | MissionState): number | null => urgency[state];

/** Orders work by urgency and then activity, with completed work at the end. */
export const compareUrgency = (
  current: { state: ThreadState | MissionState; lastActivityAt: number },
  next: { state: ThreadState | MissionState; lastActivityAt: number },
): number =>
  (urgencyOf(current.state) ?? Infinity) - (urgencyOf(next.state) ?? Infinity) ||
  next.lastActivityAt - current.lastActivityAt;

/** The list notch reflects the most urgent active child. */
export function childStatusOf(
  children: ReadonlyArray<{ state: ThreadState | MissionState; isArchived?: boolean | undefined }>,
): ThreadState | MissionState | null {
  let state: ThreadState | MissionState | null = null;
  let rank = Infinity;
  for (const child of children) {
    const urgency = urgencyOf(child.state);
    if (child.isArchived === true || urgency === null || urgency >= rank) continue;
    state = child.state;
    rank = urgency;
  }
  return state;
}
