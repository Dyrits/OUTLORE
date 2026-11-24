import { RitualRunState, RitualSchedule } from "@outlore/contracts";
import { Option, Schema } from "effect";

// How a Ritual's schedule and run state are stored and read (rituals); when it is next due is the local calendar's.

/** A stored schedule, written as JSON by this module. */
export const scheduleOf = (stored: string): RitualSchedule =>
  Schema.decodeUnknownSync(RitualSchedule)(JSON.parse(stored));

const decodeRunState = Schema.decodeUnknownOption(RitualRunState);

/**
 * How the Ritual's latest run stands. A run recorded as underway whose thread was stopped ended without the harness
 * reporting it, so it reads as interrupted; a run the service lost by stopping reads the same, at startup. A stored
 * state no run writes reads as none.
 */
export const runStateOf = (stored: string | null, threadState: string): RitualRunState | null =>
  stored === null
    ? null
    : stored === "Underway" && threadState === "Stopped"
      ? "Interrupted"
      : Option.getOrNull(decodeRunState(stored));
