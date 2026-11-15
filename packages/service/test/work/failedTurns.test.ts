import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { call, open, read, send, settle, start, withService } from "../fixtures/service.ts";

describe("finishing a sibling turn", () => {
  it.live("leaves a failed thread without backups waiting for an explicit retry", () =>
    withService(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const quest = yield* start("Hello");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
        const child = yield* open(quest.threadId, "fail claude No capacity");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Failed", child.threadId);
        const count = () =>
          sql<{ count: number }>`SELECT COUNT(*) AS count FROM turns WHERE thread_id = ${child.threadId}`.pipe(
            Effect.map(([row]) => row?.count),
          );
        expect(yield* count()).toBe(1);
        yield* send(quest.threadId, "Finish sibling work");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
        yield* Effect.sleep("100 millis");
        expect(yield* count()).toBe(1);
        expect((yield* read(quest.missionId, child.threadId)).thread.state).toBe("Failed");
      }),
    ),
  );

  it.live("lets the backup take over while its sibling also finishes", () =>
    withService(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const quest = yield* start("Hello");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
        const child = yield* open(quest.threadId, "Hello");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle", child.threadId);
        yield* call({
          _tag: "SetThreadBackups",
          backups: [{ accountId: null, effort: "default", harness: "codex", model: "gpt-5" }],
          threadId: child.threadId,
        });
        yield* send(child.threadId, "wait 50\nfail claude No capacity\nrunner");
        yield* send(quest.threadId, "wait 50\nFinish sibling work");
        yield* settle(
          quest.missionId,
          (detail) => detail.thread.harness === "codex" && detail.thread.state === "Idle",
          child.threadId,
        );
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
        const [row] = yield* sql<{
          count: number;
        }>`SELECT COUNT(*) AS count FROM turns WHERE thread_id = ${child.threadId} AND harness = 'claude'`;
        expect(row?.count).toBe(2);
      }),
    ),
  );
});
