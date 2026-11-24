import { execFileSync } from "node:child_process";
import { mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { fixture, settle, start, temporary } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const git = (folder: string, ...args: ReadonlyArray<string>) =>
  execFileSync(
    "git",
    ["-C", folder, "-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();

/** A git repository with one commit, by its real path. */
const repository = (prefix = "outlore-working-folder-") => {
  const folder = realpathSync(temporary(prefix));
  git(folder, "init", "-q", "-b", "main");
  writeFileSync(join(folder, "README.md"), "Hello\n");
  git(folder, "add", "README.md");
  git(folder, "commit", "-q", "-m", "First");
  return folder;
};

/** A linked worktree of the repository, made where the agent would make one. */
const worktreeOf = (repositoryFolder: string, name: string) => {
  const path = join(repositoryFolder, ".worktrees", name);
  git(repositoryFolder, "worktree", "add", "-q", "-b", `branch-${name}`, path);
  return path;
};

/** A script line that reports a harness tool call as it starts. */
const reported = (toolName: string, input: object) => `tooluse ${toolName} ${JSON.stringify(input)}`;

/** Runs a turn in the folder that reports the given calls, and reads the thread once it has replied. */
const afterCalls = (folder: string, ...calls: Array<string>) =>
  Effect.gen(function* () {
    const started = yield* start(calls.join("\n"), folder);
    const detail = yield* settle(started.missionId, (current) => current.messages.length === 2);
    return detail.thread;
  });

const bash = (command: string) => reported("Bash", { command });

describe("the folder a thread's tool calls moved its shell to", () => {
  it.live("is a worktree the agent made and entered with a cd", () => {
    const { layer } = live();
    const folder = repository();
    const worktree = worktreeOf(folder, "fix");
    return Effect.gen(function* () {
      expect((yield* afterCalls(folder, bash(`cd ${worktree} && bun test`))).workingFolder).toBe(worktree);
    }).pipe(Effect.provide(layer));
  });

  it.live("is the worktree a `git worktree add` made, even when the agent never changed into it", () => {
    const { layer } = live();
    const folder = repository();
    const worktree = worktreeOf(folder, "made");
    return Effect.gen(function* () {
      const thread = yield* afterCalls(folder, bash("git worktree add -b branch-made .worktrees/made"));
      expect(thread.workingFolder).toBe(worktree);
    }).pipe(Effect.provide(layer));
  });

  it.live("is the worktree that a folder inside it belongs to, and follows relative paths from the last folder", () => {
    const { layer } = live();
    const folder = repository();
    const worktree = worktreeOf(folder, "deep");
    mkdirSync(join(worktree, "src"));
    return Effect.gen(function* () {
      const thread = yield* afterCalls(folder, bash("cd .worktrees/deep"), bash("cd src"));
      expect(thread.workingFolder).toBe(worktree);
    }).pipe(Effect.provide(layer));
  });

  it.live("follows Claude Code's EnterWorktree and goes back on ExitWorktree", () => {
    const { layer } = live();
    const folder = repository();
    const worktree = worktreeOf(folder, "tool");
    return Effect.gen(function* () {
      expect((yield* afterCalls(folder, reported("EnterWorktree", { path: worktree }))).workingFolder).toBe(worktree);
      const back = yield* afterCalls(
        folder,
        reported("EnterWorktree", { path: worktree }),
        reported("ExitWorktree", {}),
      );
      expect(back.workingFolder).toBeUndefined();
    }).pipe(Effect.provide(layer));
  });

  it.live("is none after a cd back to the workspace's own checkout", () => {
    const { layer } = live();
    const folder = repository();
    const worktree = worktreeOf(folder, "away");
    return Effect.gen(function* () {
      const thread = yield* afterCalls(folder, bash(`cd ${worktree}`), bash(`cd ${folder}`));
      expect(thread.workingFolder).toBeUndefined();
    }).pipe(Effect.provide(layer));
  });

  it.live("is none for a folder outside the workspace's repository, or one that is no worktree", () => {
    const { layer } = live();
    const folder = repository();
    const other = repository("outlore-other-repository-");
    const foreign = worktreeOf(other, "foreign");
    const plain = join(folder, "docs");
    mkdirSync(plain);
    return Effect.gen(function* () {
      expect((yield* afterCalls(folder, bash(`cd ${foreign}`))).workingFolder).toBeUndefined();
      expect((yield* afterCalls(folder, bash(`cd ${plain}`))).workingFolder).toBeUndefined();
      expect((yield* afterCalls(folder, bash(`cd ${other}`))).workingFolder).toBeUndefined();
    }).pipe(Effect.provide(layer));
  });

  it.live("is none once the worktree was removed", () => {
    const { layer } = live();
    const folder = repository();
    const worktree = worktreeOf(folder, "gone");
    return Effect.gen(function* () {
      const started = yield* start(bash(`cd ${worktree}`), folder);
      yield* settle(started.missionId, (current) => current.messages.length === 2);
      rmSync(worktree, { force: true, recursive: true });
      const detail = yield* settle(started.missionId, (current) => current.messages.length === 2);
      expect(detail.thread.workingFolder).toBeUndefined();
    }).pipe(Effect.provide(layer));
  });

  it.live("is none for a thread in no workspace, and for calls that move nothing", () => {
    const { layer } = live();
    const folder = repository();
    return Effect.gen(function* () {
      expect(
        (yield* afterCalls(folder, bash("ls -la"), reported("Read", { file_path: "/x" }))).workingFolder,
      ).toBeUndefined();
      const scratch = yield* start(bash("cd /tmp"), null);
      const detail = yield* settle(scratch.missionId, (current) => current.messages.length === 2);
      expect(detail.thread.workingFolder).toBeUndefined();
    }).pipe(Effect.provide(layer));
  });
});
