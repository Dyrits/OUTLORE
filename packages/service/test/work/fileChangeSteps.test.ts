import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { maxDiffBytes } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { markPrompted, saveActivityChange } from "../../src/work/activities.ts";
import { editChangeOf } from "../../src/work/fileChanges.ts";
import { call, fixture, read, settle, start } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** A script line that reports a harness tool call as it starts. */
const reported = (toolName: string, input: object) => `tooluse ${toolName} ${JSON.stringify(input)}`;

/** Runs a turn that reports the given calls and waits for its reply. */
const runCalls = (...lines: Array<string>) =>
  Effect.gen(function* () {
    const started = yield* start(lines.join("\n"));
    const detail = yield* settle(started.missionId, (current) => current.messages.length === 2);
    return { detail, started };
  });

const diffOf = (threadId: string, activityId: string) =>
  call({ _tag: "ReadFileDiff", activityId, threadId: threadId as never });

describe("the diff of a modified file in a turn's steps", () => {
  it.live("lists an Edit with its counts and reads its diff only when asked", () =>
    Effect.gen(function* () {
      const { detail } = yield* runCalls(
        reported("Edit", {
          file_path: "/work/entries.ts",
          new_string: "const SECRET_NEW = 2;\nreturn x;",
          old_string: "const x = 1;\nreturn x;",
        }),
      );
      const [step] = detail.activities;
      expect(step).toMatchObject({ change: { added: 1, removed: 1 }, detail: "/work/entries.ts" });
      // The steps list carries the counts, never the changed text.
      expect(JSON.stringify(detail.activities)).not.toContain("SECRET_NEW");
      const diff = yield* diffOf(detail.thread.id, step?.id ?? "");
      expect(diff).toEqual({
        added: 1,
        lines: [
          { kind: "Removed", text: "const x = 1;" },
          { kind: "Added", text: "const SECRET_NEW = 2;" },
          { kind: "Context", text: "return x;" },
        ],
        note: null,
        removed: 1,
      });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("lists a MultiEdit as one step with all its edits", () =>
    Effect.gen(function* () {
      const { detail } = yield* runCalls(
        reported("MultiEdit", {
          edits: [
            { new_string: "b", old_string: "a" },
            { new_string: "d\ne", old_string: "c" },
          ],
          file_path: "/work/a.ts",
        }),
      );
      expect(detail.activities).toHaveLength(1);
      expect(detail.activities[0]?.change).toEqual({ added: 3, removed: 2 });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("reads the previous text of a file a Write replaces, and keeps only the diff", () => {
    const value = setup();
    const path = join(value.directory, "notes.txt");
    writeFileSync(path, "one\ntwo\nthree\n");
    return Effect.gen(function* () {
      const { detail } = yield* runCalls(reported("Write", { content: "one\n2\nthree\n", file_path: path }));
      const [step] = detail.activities;
      expect(step?.change).toEqual({ added: 1, removed: 1 });
      const diff = yield* diffOf(detail.thread.id, step?.id ?? "");
      expect(diff.lines).toEqual([
        { kind: "Context", text: "one" },
        { kind: "Removed", text: "two" },
        { kind: "Added", text: "2" },
        { kind: "Context", text: "three" },
      ]);
      // Nothing of the file is kept beyond the diff: the data folder holds no copy of it.
      const sql = yield* SqlClient.SqlClient;
      const rows = yield* sql<{ text: string }>`SELECT text FROM thread_activity_diffs`;
      expect(rows.map((row) => row.text).join("")).not.toContain("\nthree\n\n");
    }).pipe(Effect.provide(value.layer));
  });

  it.live("shows a Write of a new file as all additions", () => {
    const value = setup();
    const path = join(value.directory, "new", "created.txt");
    mkdirSync(join(value.directory, "new"));
    return Effect.gen(function* () {
      const { detail } = yield* runCalls(reported("Write", { content: "a\nb\n", file_path: path }));
      const [step] = detail.activities;
      expect(step?.change).toEqual({ added: 2, removed: 0 });
      expect((yield* diffOf(detail.thread.id, step?.id ?? "")).lines.map((line) => line.kind)).toEqual([
        "Added",
        "Added",
      ]);
    }).pipe(Effect.provide(value.layer));
  });

  it.live("marks a file whose last line gains a newline", () => {
    const value = setup();
    const path = join(value.directory, "ending.txt");
    writeFileSync(path, "a\nb");
    return Effect.gen(function* () {
      const { detail } = yield* runCalls(reported("Write", { content: "a\nb\n", file_path: path }));
      const diff = yield* diffOf(detail.thread.id, detail.activities[0]?.id ?? "");
      expect(diff.lines).toContainEqual({ kind: "Gap", text: "No newline at end of file" });
    }).pipe(Effect.provide(value.layer));
  });

  it.live("says plainly when a Write had already happened and the previous text is not known", () => {
    const value = setup();
    const path = join(value.directory, "already.txt");
    writeFileSync(path, "written already\n");
    return Effect.gen(function* () {
      const { detail } = yield* runCalls(reported("Write", { content: "written already\n", file_path: path }));
      const [step] = detail.activities;
      expect(step?.change).toEqual({ added: null, removed: null });
      const diff = yield* diffOf(detail.thread.id, step?.id ?? "");
      expect(diff.lines).toEqual([]);
      expect(diff.note).toContain("not known");
    }).pipe(Effect.provide(value.layer));
  });

  it.live("cuts a very large diff with a note, keeping the counts of the whole change", () =>
    Effect.gen(function* () {
      const content = Array.from({ length: 6000 }, (_, index) => `generated line ${index} with some text`).join("\n");
      const { detail } = yield* runCalls(
        reported("Edit", { file_path: "/work/big.ts", new_string: content, old_string: "" }),
      );
      const [step] = detail.activities;
      expect(step?.change).toEqual({ added: 6000, removed: 0 });
      const diff = yield* diffOf(detail.thread.id, step?.id ?? "");
      expect(diff.note).toBe("Diff cut: only the first 64 KB is kept.");
      expect(diff.added).toBe(6000);
      expect(Buffer.byteLength(diff.lines.map((line) => line.text).join("\n"))).toBeLessThanOrEqual(maxDiffBytes);
      expect(diff.lines.length).toBeLessThan(6000);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps no diff for a call that is not an edit", () =>
    Effect.gen(function* () {
      const { detail } = yield* runCalls(reported("Read", { file_path: "/work/entries.ts" }));
      expect(detail.activities[0]).not.toHaveProperty("change");
      const failure = yield* Effect.flip(diffOf(detail.thread.id, detail.activities[0]?.id ?? ""));
      expect(failure.kind).toBe("NotFound");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("deletes the diffs with the thread", () =>
    Effect.gen(function* () {
      const { detail, started } = yield* runCalls(
        reported("Edit", { file_path: "/work/a.ts", new_string: "b", old_string: "a" }),
      );
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT * FROM thread_activity_diffs`).toHaveLength(1);
      const preview = yield* call({ _tag: "PreviewDeletion", threadId: detail.thread.id });
      yield* call({ _tag: "DeleteThread", confirmation: preview.confirmation, threadId: detail.thread.id });
      expect(yield* sql`SELECT * FROM thread_activity_diffs`).toHaveLength(0);
      expect((yield* Effect.flip(read(started.missionId))).kind).toBe("NotFound");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps no diff for a call that reached the permission prompt, whichever came first", () =>
    Effect.gen(function* () {
      const { detail } = yield* runCalls(
        reported("Edit", { file_path: "/work/a.ts", new_string: "b", old_string: "a" }),
      );
      const threadId = detail.thread.id;
      const id = detail.activities[0]?.id ?? "";
      // The prompt after the call: its action shows, and the diff, which could describe a denied change, goes.
      yield* markPrompted(threadId, id, 1);
      expect((yield* Effect.flip(diffOf(threadId, id))).kind).toBe("NotFound");
      // The prompt before the call: the call's diff is not kept.
      yield* markPrompted(threadId, "toolu_prompt_first", 2);
      const change = editChangeOf("Edit", { new_string: "d", old_string: "c" });
      if (change === null) return yield* Effect.die("Missing change");
      yield* saveActivityChange(threadId, "toolu_prompt_first", change);
      expect((yield* Effect.flip(diffOf(threadId, "toolu_prompt_first"))).kind).toBe("NotFound");
    }).pipe(Effect.provide(setup().layer)),
  );
});
