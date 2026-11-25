import type { RitualSchedule, RitualScopeEntry } from "@outlore/contracts";
import { isTimeValid } from "./ritualLabels";

/** How the Ritual form names each action its scope can allow. */
export const scopeOperationLabels: Record<RitualScopeEntry["operation"], string> = {
  Archive: "Archive a quest",
  ChangeSetting: "Change a setting",
  Done: "Mark a quest Done",
  Rename: "Rename a quest",
  Stop: "Stop a quest's threads",
};

/** Whether the action takes an exact new value: a quest's new title, or a setting's new value. */
export const isValued = (operation: RitualScopeEntry["operation"]) =>
  operation === "Rename" || operation === "ChangeSetting";

/** Whether the schedule can be sent: a valid time, or hours within the allowed range. */
export const isScheduleValid = (schedule: RitualSchedule) =>
  schedule._tag === "Hourly" ? schedule.hours >= 1 && schedule.hours <= 168 : isTimeValid(schedule.time);
