import { Effect } from "effect";
import { SqlClient } from "effect/sql";

// A mission's latest activity, which orders the dashboard and times the inactivity warnings (mission-tracking).
// A leaf, so every module that records activity can import it without a module-load cycle.

/** Hours of silence before a realm Missive warns about a thread in Attention or Resting. */
export const inactivityMissiveHours = { Attention: 4, Resting: 12 } as const;

/** Records a mission's latest activity. Callers run it in a transaction. */
export const touchMission = Effect.fnUntraced(function* (missionId: string, now: number) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE missions SET last_activity_at = ${now} WHERE id = ${missionId}`;
});
