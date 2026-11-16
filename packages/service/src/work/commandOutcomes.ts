import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";
import { unchanged, type WithFollowUps } from "./commands.ts";

const Wakes = Schema.Struct({
  missionsToWake: Schema.Array(Schema.String),
  threadsToWake: Schema.Array(Schema.String),
});
const decodeWakes = Schema.decodeUnknownSync(Wakes);

/** Finds an outcome's owning thread across the result shapes saved by owner commands. */
const readOwner = Effect.fnUntraced(function* (outcome: string) {
  const sql = yield* SqlClient.SqlClient;
  const [owner] = yield* sql<{ threadId: string | null }>`SELECT COALESCE(
      json_extract(${outcome}, '$.threadId'),
      (SELECT thread_id FROM messages WHERE id = json_extract(${outcome}, '$.messageId')),
      (SELECT top_thread_id FROM missions WHERE id = json_extract(${outcome}, '$.missionId'))
    ) AS threadId`;
  return owner?.threadId ?? null;
});

/** Saves a command's value and replay wakes together in its runner's transaction. */
export const recordOnce = Effect.fnUntraced(function* <A, E, R>(
  requestId: string,
  tag: string,
  work: Effect.Effect<WithFollowUps<A>, E, R>,
) {
  const sql = yield* SqlClient.SqlClient;
  const [stored] = yield* sql<{ requestTag: string; outcome: string; wakes: string | null }>`
      SELECT request_tag AS requestTag, outcome, wakes FROM command_outcomes WHERE request_id = ${requestId}`;
  if (stored !== undefined) {
    if (stored.requestTag !== tag) return yield* invalid("This request identifier was used for another command.");
    // Earlier versions stored just the value. Only these three requests used replay wakes.
    const owner = stored.wakes === null ? yield* readOwner(stored.outcome) : null;
    const wakes =
      stored.wakes === null
        ? {
            missionsToWake: [],
            threadsToWake: owner !== null && ["OpenThread", "SendMessage", "StartMission"].includes(tag) ? [owner] : [],
          }
        : decodeWakes(JSON.parse(stored.wakes));
    // The value is an opaque result written by the same request handler, retained across retries.
    const value = JSON.parse(stored.outcome) as A;
    return unchanged(value, wakes);
  }
  const done = yield* work;
  const outcome = JSON.stringify(done.value);
  const owner = yield* readOwner(outcome);
  const wakes = JSON.stringify({
    missionsToWake: done.followUps.missionsToWake,
    threadsToWake: done.followUps.threadsToWake,
  });
  yield* sql`INSERT INTO command_outcomes (request_id, request_tag, outcome, wakes, thread_id)
      VALUES (${requestId}, ${tag}, ${outcome}, ${wakes}, ${owner})`;
  return { ...done, followUps: { ...done.followUps, isChanged: true } };
});

/** Forgets results owned by erased threads, including the value-only records written by older releases. */
export const forgetOutcomesOf = Effect.fnUntraced(function* (threadIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  const legacy = yield* sql<{ requestId: string; outcome: string }>`
      SELECT request_id AS requestId, outcome FROM command_outcomes WHERE thread_id IS NULL AND wakes IS NULL`;
  for (const stored of legacy) {
    const owner = yield* readOwner(stored.outcome);
    if (owner !== null && threadIds.includes(owner))
      yield* sql`DELETE FROM command_outcomes WHERE request_id = ${stored.requestId}`;
  }
  yield* sql`DELETE FROM command_outcomes WHERE thread_id IN ${sql.in(threadIds)}`;
});
