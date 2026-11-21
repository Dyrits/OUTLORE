import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, settle, startMission, temporary } from "../fixtures/service.ts";
import { answerOpen, idleWith, withHarnesses } from "../fixtures/standIns.ts";

describe("file diffs from harness results", () => {
  for (const harness of ["codex", "opencode", "vibe"] as const) {
    it.live(`shows ${harness}'s completed edit in Steps in a folder without Git`, () => {
      const { layer } = withHarnesses();
      const folder = temporary("outlore-diff-workspace-");
      return Effect.gen(function* () {
        const started = yield* startMission({ harness, text: "report file changes", workspacePath: folder });
        const detail = yield* settle(started.missionId, idleWith(1));
        const step = detail.activities.find((activity) => activity.detail === "notes.txt");
        expect(step?.change).toEqual({ added: 1, removed: 1 });
        if (step === undefined) return yield* Effect.die("Missing edit step");
        const diff = yield* call({ _tag: "ReadFileDiff", activityId: step.id, threadId: started.threadId });
        expect(diff.lines).toContainEqual({ kind: "Removed", text: "old" });
        expect(diff.lines).toContainEqual({ kind: "Added", text: "new" });
        if (harness === "vibe") expect(detail.activities).toHaveLength(1);
        if (harness === "codex") {
          const created = detail.activities.find((activity) => activity.detail === "created.txt");
          const deleted = detail.activities.find((activity) => activity.detail === "deleted.txt");
          expect(created?.change).toEqual({ added: 1, removed: 0 });
          expect(deleted?.change).toEqual({ added: 0, removed: 1 });
          if (created === undefined) return yield* Effect.die("Missing creation step");
          const creation = yield* call({ _tag: "ReadFileDiff", activityId: created.id, threadId: started.threadId });
          expect(creation.lines).toEqual([{ kind: "Added", text: "+literal prefix" }]);
        }
        expect(existsSync(join(folder, ".git"))).toBe(false);
        expect(detail.activities.filter((activity) => activity.change).map((activity) => activity.detail)).toEqual(
          harness === "codex" ? ["notes.txt", "created.txt", "deleted.txt"] : ["notes.txt"],
        );
      }).pipe(Effect.provide(layer));
    });
  }

  it.live("keeps the existing step for a denied Vibe write without a diff", () => {
    const { layer } = withHarnesses();
    const folder = temporary("outlore-diff-workspace-");
    return Effect.gen(function* () {
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, defaultPermissionMode: "Supervised" } });
      const started = yield* startMission({ harness: "vibe", text: "report file changes", workspacePath: folder });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.activities).toHaveLength(1);
      expect(detail.activities[0]).not.toHaveProperty("change");
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the existing step for a Vibe edit that reports no diff", () => {
    const { layer } = withHarnesses();
    const folder = temporary("outlore-diff-workspace-");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "vibe", text: "edit notes.txt", workspacePath: folder });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.activities).toHaveLength(1);
      expect(detail.activities[0]).not.toHaveProperty("change");
    }).pipe(Effect.provide(layer));
  });
});
