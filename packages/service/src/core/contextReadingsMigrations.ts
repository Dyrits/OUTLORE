import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** Stores thread context readings apart from token usage so a turn with unknown usage still feeds the gauge. */
export const contextReadingsMigrations = {
  // Context describes a thread's window state, not what a turn cost, so keeping it apart from `usage` lets a provider that reports only `used` and `size` feed the gauge while its turn stays uncounted in usage and spending.
  "0077_context_readings": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE context_readings (
      thread_id TEXT NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
      turn_id TEXT,
      model TEXT,
      used INTEGER,
      size INTEGER,
      recorded_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE INDEX context_readings_by_thread ON context_readings (thread_id, recorded_at)`;
    yield* sql`CREATE INDEX context_readings_by_model_size ON context_readings (model, recorded_at) WHERE size IS NOT NULL`;
  }),
};
