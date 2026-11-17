import type { MissionState } from "@outlore/contracts";

// Ordered from most to least urgent (mission-tracking specification). Done and
// Stopped add no urgency; Idle is the provisional fallback until it is settled.
const urgency: ReadonlyArray<MissionState> = ["Attention", "Failed", "Running", "Waiting", "Idle"];

/** A quest's state while it is not ended: the most urgent among its threads' states. */
export const workedOutStateOf = (states: ReadonlyArray<string>): MissionState =>
  urgency.find((state) => states.includes(state)) ?? "Idle";
