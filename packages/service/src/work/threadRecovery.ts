import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";
import { requireChatterDecision } from "./chatter.ts";
import { changed } from "./followUps.ts";
import { releaseThread, resumeStopped } from "./lifecycle.ts";
import { isNotBeingDeletedOf } from "./questVisibility.ts";

/** The owner continues a stopped thread after resolving any chatter pause. */
export const resumeThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{
    state: string;
  }>`SELECT state FROM threads WHERE id = ${threadId} AND ${isNotBeingDeletedOf(sql, "threads")}`;
  if (thread?.state !== "Stopped") return yield* invalid("This thread is not stopped.");
  yield* requireChatterDecision(threadId);
  yield* resumeStopped(threadId);
  return changed(null, { threadsToWake: [threadId] });
});

/** The owner retries a failed turn or releases a thread held by its missing workspace. */
export const retryThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [thread] = yield* sql<{ blocker: string | null; failure: string | null; state: string }>`
              SELECT blocker, failure, state FROM threads WHERE id = ${threadId} AND ${isNotBeingDeletedOf(sql, "threads")}`;
  // After a failed turn, its messages wait undelivered: Retry runs them again, on the current runner.
  if (thread !== undefined && thread.blocker === null && thread.failure !== null) {
    if (thread.state === "Underway" || thread.state === "Attention" || thread.state === "Stopped")
      return yield* invalid("This thread is in a turn or stopped; it cannot retry now.");
    return changed(null, { threadsToWake: [threadId] });
  }
  if (thread?.blocker !== "MissingWorkspace")
    return yield* invalid("This thread has no failed turn and is not waiting on its workspace folder.");
  yield* releaseThread(threadId);
  // Still missing: admit sends it back to Attention.
  return changed(null, { threadsToWake: [threadId] });
});
