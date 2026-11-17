import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { Commands, changed, makeCommands } from "../../src/work/index.ts";
import { call, start, withService } from "../fixtures/service.ts";

describe("replaying owner commands", () => {
  it.live("keeps the value and wake instructions together without redoing storage", () =>
    withService(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const wakes: string[] = [];
        const commands = makeCommands({
          publish: Effect.void,
          removeScratch: () => Effect.void,
          sql,
          threads: {
            cancel: () => Effect.void,
            wake: (id) =>
              Effect.sync(() => {
                wakes.push(id);
              }),
            wakeMission: () => Effect.void,
          },
          withdrawQuestions: () => Effect.void,
        });
        const quest = yield* start("Hello");
        const operation = commands.once(
          "recorded",
          "TestCommand",
          Effect.succeed(changed({ threadId: quest.threadId }, { threadsToWake: [quest.threadId] })),
        );
        const first = yield* commands.run(operation);
        const [stored] = yield* sql<{
          wakes: string;
          threadId: string;
        }>`SELECT wakes, thread_id AS threadId FROM command_outcomes WHERE request_id = 'recorded'`;
        expect(stored?.threadId).toBe(quest.threadId);
        expect(JSON.parse(stored?.wakes ?? "{}")).toEqual({ missionsToWake: [], threadsToWake: [quest.threadId] });
        const replay = yield* commands.run(commands.once("recorded", "TestCommand", Effect.die("must not repeat")));
        expect(replay).toEqual(first);
        expect(wakes).toEqual([quest.threadId, quest.threadId]);
      }),
    ),
  );

  it.live("reads an outcome saved before wake instructions were stored", () =>
    withService(
      Effect.gen(function* () {
        const commands = yield* Commands;
        const sql = yield* SqlClient.SqlClient;
        const quest = yield* start("Hello");
        yield* sql`INSERT INTO command_outcomes (request_id, request_tag, outcome) VALUES ('legacy', 'StartMission', ${JSON.stringify(quest)})`;
        expect(yield* commands.run(commands.once("legacy", "StartMission", Effect.die("must not repeat")))).toEqual(
          quest,
        );
        const refused = yield* Effect.flip(
          commands.run(commands.once("legacy", "SendMessage", Effect.succeed(changed(null)))),
        );
        expect(refused).toMatchObject({ kind: "InvalidInput" });
      }),
    ),
  );

  it.live("forgets an empty quest's creation outcome when the quest is deleted", () =>
    withService(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const first = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "empty" });
        yield* sql`INSERT INTO command_outcomes (request_id, request_tag, outcome) VALUES ('old-empty', 'StartEmptyQuest', ${JSON.stringify(first)})`;
        const preview = yield* call({ _tag: "PreviewEnding", ending: "Archived", missionId: first.missionId });
        yield* call({ _tag: "EndMission", ending: "Archived", missionId: first.missionId, snapshot: preview.snapshot });
        const next = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "empty" });
        expect(next.missionId).not.toBe(first.missionId);
        expect(yield* sql`SELECT request_id FROM command_outcomes WHERE request_id = 'old-empty'`).toEqual([]);
      }),
    ),
  );
});
