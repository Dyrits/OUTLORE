import { companionTokenOf, type MissionDetail } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { settle, start } from "./service.ts";

// What the Companion mention's tests share (thread-messaging, Mentioning a Companion with @; CHG-0781).

export const token = (
  model: string,
  harness: "antigravity" | "claude" | "codex" = "codex",
  accountId: string | null = null,
) => companionTokenOf({ accountId, harness, model });

export const isRested = (detail: MissionDetail) => detail.thread.state === "Resting";
export const repliesOf = (detail: MissionDetail, model: string) =>
  detail.messages.filter((message) => message.sender === "agent" && message.model === model);
export const turnCountOf = (threadId: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM turns WHERE thread_id = ${threadId}`;
    return row?.count ?? 0;
  });
export const companionRows = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<{ missionId: string; threadId: string }>`
    SELECT mission_id AS missionId, thread_id AS threadId FROM companion_threads ORDER BY rowid`;
});

/** A quest that has run its first turn, so a mention reaches a conversation with a Companion's reply in it. */
export const restedQuest = Effect.gen(function* () {
  const quest = yield* start("Hello");
  yield* settle(quest.missionId, isRested);
  return quest;
});
