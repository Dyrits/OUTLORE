import { mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  answer,
  call,
  databaseFile,
  failureOf,
  isAsking,
  isReplied,
  lastReply,
  live,
  openQuestion,
  send,
  serviceOn,
  settle,
  start,
  unprotected,
} from "../fixtures/approvals.ts";
import { createRepository, runGit } from "../fixtures/repositories.ts";

describe("a thread folder that is a link", () => {
  /** The fake harness's folder question, as Claude Code and Codex ask it before starting in a linked folder. */
  const folder = (file_path: string, startsIn: string | null = null) =>
    `folder Claude ${JSON.stringify({ description: `The folder ${file_path} points elsewhere`, file_path, startsIn })}`;

  it.live("asks a one-time question that offers no standing permission and refuses Always allow", () =>
    Effect.gen(function* () {
      const started = yield* start(folder("/somewhere/linked"));
      const asked = openQuestion(yield* settle(started.missionId, isAsking));
      expect(asked).toMatchObject({ pattern: null, permission: null, source: "Harness" });
      expect(asked.summary).toContain("/somewhere/linked");
      const refused = yield* failureOf({
        _tag: "AnswerQuestion",
        answer: "AlwaysAllow",
        message: null,
        questionId: asked.id,
      });
      expect(refused.message).toContain("one-time");
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
      yield* answer(asked, "Allow");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toBe("Echo: prompt allowed");
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("never lets an earlier standing permission answer it", () =>
    Effect.gen(function* () {
      // A row as the earlier OpenCode folder question saved it: "Run without a sandbox" for the folder.
      const linked = "/somewhere/linked";
      const first = yield* start(`prompt OpenCode ${JSON.stringify({ file_path: linked })}`);
      yield* answer(openQuestion(yield* settle(first.missionId, isAsking)), "AlwaysAllow");
      yield* settle(first.missionId, isReplied);
      expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toHaveLength(1);
      yield* send(first.threadId, folder(linked));
      const asking = yield* settle(first.missionId, (current) => current.questions.length === 2 && isAsking(current));
      expect(openQuestion(asking)).toMatchObject({ outcome: null, pattern: null, permission: null });
    }).pipe(Effect.provide(unprotected())),
  );

  /** A service whose browsable root holds a workspace folder and a folder outside it, both real paths. */
  const withWorkspace = () => {
    const filename = databaseFile();
    const base = realpathSync(join(filename, ".."));
    const workspace = join(base, "workspace");
    const elsewhere = join(base, "elsewhere");
    mkdirSync(workspace);
    mkdirSync(elsewhere);
    return { elsewhere, layer: serviceOn(filename), workspace };
  };
  const edit = (file_path: string) => `prompt Edit ${JSON.stringify({ file_path })}`;

  it.live("counts a file in the link's target as outside the thread's folder", () => {
    const { elsewhere, layer, workspace } = withWorkspace();
    return Effect.gen(function* () {
      const started = yield* start("hello", workspace);
      yield* settle(started.missionId, isReplied);
      rmSync(workspace, { recursive: true });
      symlinkSync(elsewhere, workspace);
      for (const file of [join(elsewhere, "plan.md"), join(workspace, "plan.md")]) {
        yield* send(started.threadId, edit(file));
        const asking = yield* settle(started.missionId, isAsking);
        expect(openQuestion(asking)).toMatchObject({ permission: "Change a file outside the workspace" });
        yield* answer(openQuestion(asking), "Deny");
        yield* settle(started.missionId, isReplied);
      }
    }).pipe(Effect.provide(layer));
  });

  it.live("counts a file in the link's target as inside once the owner allowed the start there", () => {
    const { elsewhere, layer, workspace } = withWorkspace();
    return Effect.gen(function* () {
      const started = yield* start("hello", workspace);
      yield* settle(started.missionId, isReplied);
      rmSync(workspace, { recursive: true });
      symlinkSync(elsewhere, workspace);
      yield* send(started.threadId, `${folder(workspace, elsewhere)}\n${edit(join(elsewhere, "plan.md"))}`);
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Allow");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toBe("Echo: prompt allowed | prompt allowed");
      expect(detail.questions.at(-1)?.outcome).toBe("AllowedAutomatically");
      // Pointed elsewhere again, the earlier answer no longer counts.
      const other = join(elsewhere, "..", "other");
      mkdirSync(other);
      rmSync(workspace);
      symlinkSync(other, workspace);
      yield* send(started.threadId, edit(join(other, "plan.md")));
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        permission: "Change a file outside the workspace",
      });
    }).pipe(Effect.provide(layer));
  });
});

describe("using a workspace's git worktrees", () => {
  /** A workspace that is a repository with one linked worktree beside it, an unrelated folder beside both, and a worktree of another repository. */
  const makeRepositoryFixture = () => {
    const filename = databaseFile();
    const base = realpathSync(join(filename, ".."));
    const workspace = createRepository(base, "workspace");
    const worktree = join(base, "workspace-side");
    runGit(workspace, "worktree", "add", "-q", "-b", "side", worktree);
    const unrelated = join(base, "workspace-unrelated");
    mkdirSync(unrelated);
    const other = createRepository(base, "other");
    const otherWorktree = join(base, "other-side");
    runGit(other, "worktree", "add", "-q", "-b", "other-side", otherWorktree);
    return { layer: serviceOn(filename), otherWorktree, unrelated, workspace, worktree };
  };
  const edit = (file_path: string) => `prompt Edit ${JSON.stringify({ file_path })}`;

  it.live("changes a file in a worktree of the workspace unasked", () => {
    const { layer, workspace, worktree } = makeRepositoryFixture();
    return Effect.gen(function* () {
      const started = yield* start(edit(join(worktree, "plan.md")), workspace);
      const detail = yield* settle(started.missionId, isReplied);
      expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks about a file in an unrelated sibling folder or in a worktree of another repository", () => {
    const { layer, otherWorktree, unrelated, workspace } = makeRepositoryFixture();
    return Effect.gen(function* () {
      for (const folder of [unrelated, otherWorktree]) {
        const started = yield* start(edit(join(folder, "plan.md")), workspace);
        expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
          permission: "Change a file outside the workspace",
        });
      }
    }).pipe(Effect.provide(layer));
  });

  it.live("asks again about a worktree once its folder is replaced by a link", () => {
    const { layer, unrelated, workspace, worktree } = makeRepositoryFixture();
    return Effect.gen(function* () {
      const started = yield* start("hello", workspace);
      yield* settle(started.missionId, isReplied);
      rmSync(worktree, { recursive: true });
      symlinkSync(unrelated, worktree);
      yield* send(started.threadId, edit(join(worktree, "plan.md")));
      expect(openQuestion(yield* settle(started.missionId, isAsking))).toMatchObject({
        permission: "Change a file outside the workspace",
      });
    }).pipe(Effect.provide(layer));
  });
});
