import type { MissionState } from "@outlore/contracts";

/** What a realm's mark can be: it has no status of its own, so only what its active quests show (CHG-0599). */
export type RealmMark = "Attention" | "Failed" | "Underway";

/** The marks in the order they win, most urgent first. */
const marks = ["Failed", "Attention", "Underway"] as const satisfies ReadonlyArray<RealmMark>;

/**
 * A realm's mark, derived from the states of its active quests and never stored: Failed or Attention when one has it
 * (Failed first), otherwise Underway when one is, otherwise none. A quest that is over or archived adds nothing.
 */
export const realmMarkOf = (states: ReadonlyArray<MissionState>): RealmMark | null =>
  marks.find((mark) => states.includes(mark)) ?? null;
