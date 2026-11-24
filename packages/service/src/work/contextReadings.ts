import { Effect } from "effect";
import { SqlClient } from "effect/sql";

// Context readings live apart from token usage so a turn with unknown usage still feeds the gauge, while older `usage` rows remain readable without rewriting them.

/** One context reading reported for a thread. */
export type ContextReading = {
  readonly model: string | null;
  readonly recordedAt: number;
  readonly size: number | null;
  readonly threadId: string;
  readonly turnId: string | null;
  readonly used: number | null;
};

/** Records a thread's context reading when at least one of its used tokens or window size is known. */
export const recordContextReading = Effect.fnUntraced(function* (reading: ContextReading) {
  if (reading.used === null && reading.size === null) return;
  const sql = yield* SqlClient.SqlClient;
  yield* sql`INSERT INTO context_readings (thread_id, turn_id, model, used, size, recorded_at)
    VALUES (${reading.threadId}, ${reading.turnId}, ${reading.model}, ${reading.used}, ${reading.size}, ${reading.recordedAt})`;
});

/** The thread's latest reported context token count from either `context_readings` or older `usage` rows, or null. */
export const readLatestContextUsed = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  // Compare both sources by timestamp so older `usage` rows keep feeding the gauge until a newer reading replaces them.
  const [latest] = yield* sql<{ used: number }>`
    SELECT used FROM (
      SELECT used, recorded_at AS at, 1 AS source, rowid AS seq
      FROM context_readings WHERE thread_id = ${threadId} AND used IS NOT NULL
      UNION ALL
      SELECT context AS used, ended_at AS at, 0 AS source, rowid AS seq
      FROM usage WHERE thread_id = ${threadId} AND context IS NOT NULL
    ) ORDER BY at DESC, source DESC, seq DESC LIMIT 1`;
  return latest?.used ?? null;
});
