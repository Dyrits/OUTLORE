import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { storeLayer } from "../../src/core/index.ts";
import { changed, makeCommands, noFollowUps } from "../../src/work/index.ts";

const directories: Array<string> = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** A bare store in a temporary folder, with no threads behind it. */
const bareStore = () => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-published-topics-"));
  directories.push(directory);
  return storeLayer(join(directory, "store.sqlite"));
};

/** A runner that records what a change's announcement is told to name. */
const recordingRunner = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const calls: Array<string> = [];
  const commands = makeCommands({
    publish: Effect.sync(() => {
      calls.push("publish");
    }),
    publishTopics: (topics) =>
      Effect.sync(() => {
        calls.push(`publish ${topics.join(" ")}`);
      }),
    removeScratch: () => Effect.void,
    sql,
    threads: { cancel: () => Effect.void, wake: () => Effect.void, wakeMission: () => Effect.void },
    withdrawQuestions: () => Effect.void,
  });
  return { calls, commands, sql };
});

describe("publishing a change's topics", () => {
  it.effect("announces only the topics a change touched, and everything for one that names none", () =>
    Effect.gen(function* () {
      const { calls, commands, sql } = yield* recordingRunner;
      yield* commands.run(
        sql`INSERT INTO browsable_roots (path, added_at) VALUES ('/a', 0)`.pipe(
          Effect.as(changed(null, { topics: ["work"] })),
        ),
      );
      yield* commands.apply({ ...noFollowUps, isChanged: true });
      yield* commands.apply({ ...noFollowUps, isChanged: true, topics: ["work", "spend"] });
      expect(calls).toEqual(["publish work", "publish", "publish work spend"]);
    }).pipe(Effect.provide(bareStore())),
  );
});
