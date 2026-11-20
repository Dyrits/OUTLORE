import type { MissionState } from "@outlore/contracts";

/** What a realm's mark can be: it has no status of its own, so only what its active quests show (CHG-0599). */
export type RealmMark = "Attention" | "Failed" | "Fulfilled" | "Resting" | "Underway" | "Waiting";

/** The marks in the order they win, most urgent first. */
const marks = ["Failed", "Attention", "Underway", "Waiting", "Resting"] as const satisfies ReadonlyArray<RealmMark>;

/**
 * A realm’s mark is derived from its quests: Failed, Attention, Underway, Waiting, then Resting take priority in that order.
 * When every unarchived quest is fulfilled, the realm is Fulfilled; an empty realm has no mark.
 */
export const realmMarkOf = (states: ReadonlyArray<MissionState>): RealmMark | null =>
  marks.find((mark) => states.includes(mark)) ??
  (states.includes("Fulfilled") && states.every((state) => state === "Fulfilled" || state === "Archived")
    ? "Fulfilled"
    : null);
