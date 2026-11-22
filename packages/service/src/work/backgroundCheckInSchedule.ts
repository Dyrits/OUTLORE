import type { Settings } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings } from "../core/index.ts";
import { nextRunAfter } from "./ritualSchedule.ts";

type CheckInSettings = NonNullable<Settings["backgroundCheckIns"]>;

const claimDueCheckIn = Effect.gen(function* () {
  const config = (yield* readSettings).backgroundCheckIns;
  if (!config?.isEnabled) return null;

  const now = yield* Clock.currentTimeMillis;
  const date = new Date(now);
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const due = nextRunAfter({ _tag: "Daily", time: config.time }, midnight - 1);
  if (now < due) return null;

  // The calendar day remains the same if the owner edits the time or the clock repeats an hour.
  const day = [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
  const sql = yield* SqlClient.SqlClient;
  const claimed = yield* sql<{ value: string }>`
    INSERT INTO settings (key, value) VALUES ('backgroundCheckInAttemptDay', ${day})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value WHERE settings.value < excluded.value
    RETURNING value`;
  return claimed.length === 0 ? null : config;
});

/** Claims the current local day's run before calling inference, without holding a write transaction during review. */
export const runDueBackgroundCheckIn = <Error, Requirements>(
  review: (config: CheckInSettings) => Effect.Effect<void, Error, Requirements>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const config = yield* sql.withTransaction(claimDueCheckIn);
    if (config !== null) yield* review(config);
  });
