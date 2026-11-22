import { Schema } from "effect";
import { BackupCompanion } from "./companions.ts";
import { WorkspaceId } from "./ids.ts";
import { TimeOfDay } from "./ritualSchedules.ts";

/** The owner-selected scope, local time, and Companions, retained while check-ins are paused. */
export const BackgroundCheckIns = Schema.Struct({
  companion: BackupCompanion,
  isEnabled: Schema.Boolean,
  paidFallback: Schema.NullOr(BackupCompanion),
  realmIds: Schema.Array(WorkspaceId).check(Schema.isMinLength(1)),
  time: TimeOfDay,
});
