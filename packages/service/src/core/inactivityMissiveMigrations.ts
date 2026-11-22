import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** Persists which inactivity episode has already produced a Missive for each thread. */
export const inactivityMissiveMigrations = {
  "0074_inactivity_missives": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN inactivity_warned_message_id TEXT`;
  }),
};
