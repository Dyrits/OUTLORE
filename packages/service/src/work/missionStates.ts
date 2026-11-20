import { type MissionState, ThreadState } from "@outlore/contracts";
import { Schema } from "effect";

// Mission tracking, Mission state (CHG-0599): the status shown for a quest or an errand is its own state rolled up
// with the active threads beneath it. Stopped, Fulfilled and archived threads add nothing beneath it.

const isThreadState = Schema.is(ThreadState);

/** The thread states in a comma-separated column; a value no state writes is left out. */
export const threadStatesOf = (text: string | null): ThreadState[] => (text?.split(",") ?? []).filter(isThreadState);

/** The status shown for a thread: Failed or Attention when it or a thread beneath it has it, else Waiting, else its own. */
export const rolledUpStateOf = (own: ThreadState, beneath: ReadonlyArray<ThreadState>): ThreadState => {
  const states = [own, ...beneath];
  if (states.includes("Failed")) return "Failed";
  if (states.includes("Attention")) return "Attention";
  const isWorkingBeneath = beneath.some((state) => state === "Underway" || state === "Waiting");
  return (own === "Resting" || own === "Waiting") && isWorkingBeneath ? "Waiting" : own;
};

/**
 * A quest's status while it is not ended: Fresh when it holds nothing, else the top thread rolled up over the rest
 * of its tree (its other active threads, whatever their depth). A top thread that reported its result leaves the quest
 * Resting, for the owner to mark it done or go on: only the owner's ending makes a quest Fulfilled.
 */
export const questStateOf = (top: ThreadState, others: ReadonlyArray<ThreadState>, isEmpty: boolean): MissionState =>
  isEmpty ? "Fresh" : rolledUpStateOf(top === "Fulfilled" ? "Resting" : top, others);

/** The status shown for each thread of a tree: its own, rolled up with its active descendants'. */
export const shownStatesOf = (
  threads: ReadonlyArray<{
    readonly id: string;
    readonly isArchived: boolean;
    readonly parentId: string | null;
    readonly state: ThreadState;
  }>,
): ReadonlyMap<string, ThreadState> => {
  const childrenOf = new Map<string, Array<(typeof threads)[number]>>();
  for (const thread of threads) {
    if (thread.parentId === null || thread.isArchived) continue;
    childrenOf.set(thread.parentId, [...(childrenOf.get(thread.parentId) ?? []), thread]);
  }
  const descendantStatesOf = (id: string): ThreadState[] =>
    (childrenOf.get(id) ?? []).flatMap((child) => [child.state, ...descendantStatesOf(child.id)]);
  return new Map(threads.map((thread) => [thread.id, rolledUpStateOf(thread.state, descendantStatesOf(thread.id))]));
};
