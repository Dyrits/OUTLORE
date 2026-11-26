import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { ownCopyNameOf } from "../../src/work/ownCopies.ts";
import { prepareStartingContext } from "../../src/work/startingContext.ts";
import { seedLegacyErrand } from "../fixtures/legacyErrands.ts";
import { call, fixture, read, settle, start, temporary, tool } from "../fixtures/service.ts";

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
const repository = () => {
  const folder = realpathSync(temporary("outlore-own-copy-"));
  git(folder, "init", "-q", "-b", "main");
  writeFileSync(join(folder, "README.md"), "Hello\n");
  git(folder, "add", "README.md");
  git(folder, "commit", "-q", "-m", "First");
  return folder;
};

/** The id `open_thread` answered with, or the refusal itself when it opened nothing. */
const openedIdOf = (answer: string) => {
  const found = /^Opened thread (\S+)\./.exec(answer)?.[1];
  return found === undefined ? null : ThreadId.make(found);
};

/** A quest in the folder whose top thread has finished its first turn. */
const idleIn = (folder: string | null) =>
  Effect.gen(function* () {
    const started = yield* start("Hello", folder);
    yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
    return started;
  });

describe("naming an own copy", () => {
  it("joins the title's words with dashes and adds the thread's short id", () => {
    expect(ownCopyNameOf("Fix the Sidebar: realms!", "0f3a9c21-77aa-4b2e")).toBe("fix-the-sidebar-realms-0f3a9c21");
  });

  it("keeps only the short id for a title with no letters or digits", () => {
    expect(ownCopyNameOf("…", "ABCDEF1234")).toBe("abcdef12");
  });
});

describe("opening a thread with an own copy", () => {
  it.live("makes a worktree in .worktrees on a mission branch and starts the thread there", () => {
    const { layer } = live();
    const folder = repository();
    return Effect.gen(function* () {
      const started = yield* idleIn(folder);
      const answer = yield* tool(started.threadId, "open_thread", { ownCopy: true, request: "Fix it on a branch." });
      const childId = openedIdOf(answer);
      if (childId === null) return yield* Effect.die(new Error(answer));
      const { context, cwd } = yield* prepareStartingContext(childId);
      expect(cwd.startsWith(`${join(folder, ".worktrees")}/`)).toBe(true);
      expect(existsSync(join(cwd, "README.md"))).toBe(true);
      const branch = git(cwd, "branch", "--show-current");
      expect(branch.startsWith("mission/")).toBe(true);
      expect(context).toContain(`on the branch ${branch}, made from ${folder}`);
      // The repository does not list the worktrees folder as untracked.
      expect(git(folder, "status", "--porcelain")).toBe("");
    }).pipe(Effect.provide(layer));
  });

  it.live("shares the own copy with a thread opened beneath it without asking for its own", () => {
    const { layer } = live();
    const folder = repository();
    return Effect.gen(function* () {
      const started = yield* idleIn(folder);
      const childId = openedIdOf(yield* tool(started.threadId, "open_thread", { ownCopy: true, request: "Branch." }));
      if (childId === null) return yield* Effect.die(new Error("not opened"));
      const { threadId: grandchildId } = yield* seedLegacyErrand(childId, "Help on the branch.");
      expect((yield* prepareStartingContext(grandchildId)).cwd).toBe((yield* prepareStartingContext(childId)).cwd);
      expect((yield* prepareStartingContext(started.threadId)).cwd).toBe(folder);
    }).pipe(Effect.provide(layer));
  });

  it.live("tells the app where a thread works, so its `!` terminal can start there", () => {
    const { layer } = live();
    const folder = repository();
    return Effect.gen(function* () {
      const started = yield* idleIn(folder);
      const childId = openedIdOf(yield* tool(started.threadId, "open_thread", { ownCopy: true, request: "Branch." }));
      if (childId === null) return yield* Effect.die(new Error("not opened"));
      const { threadId: grandchildId } = yield* seedLegacyErrand(childId, "Help on the branch.");
      const { cwd } = yield* prepareStartingContext(childId);
      const branch = git(cwd, "branch", "--show-current");
      // The thread in the copy and the thread sharing it both show it; the quest's top thread shows none.
      expect((yield* read(started.missionId, childId)).thread.ownCopy).toEqual({ branch, isMissing: false, path: cwd });
      expect((yield* read(started.missionId, grandchildId)).thread.ownCopy).toEqual({
        branch,
        isMissing: false,
        path: cwd,
      });
      expect((yield* read(started.missionId, started.threadId)).thread.ownCopy).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses an own copy for a quest with no workspace", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const started = yield* idleIn(null);
      const answer = yield* tool(started.threadId, "open_thread", { ownCopy: true, request: "Branch." });
      expect(answer).toContain("an own copy needs a workspace");
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses an own copy for a workspace that is not the top folder of a git repository", () => {
    const { layer } = live();
    const folder = join(repository(), "docs");
    mkdirSync(folder);
    return Effect.gen(function* () {
      const started = yield* idleIn(folder);
      const answer = yield* tool(started.threadId, "open_thread", { ownCopy: true, request: "Branch." });
      expect(answer).toContain("top folder of a git repository");
      expect(existsSync(join(folder, ".worktrees"))).toBe(false);
    }).pipe(Effect.provide(layer));
  });

  it.live(
    "marks ownCopy missing without blaming the realm folder, and keeps both errands Fulfilled when marked done",
    () => {
      const { layer } = live();
      const folder = repository();
      return Effect.gen(function* () {
        const started = yield* idleIn(folder);
        const firstId = openedIdOf(yield* tool(started.threadId, "open_thread", { ownCopy: true, request: "First." }));
        const secondId = openedIdOf(
          yield* tool(started.threadId, "open_thread", { ownCopy: true, request: "Second." }),
        );
        if (firstId === null || secondId === null) return yield* Effect.die(new Error("not opened"));
        yield* settle(started.missionId, (detail) =>
          [firstId, secondId].every((id) => detail.threads.find((t) => t.id === id)?.state === "Resting"),
        );
        const firstCopy = (yield* read(started.missionId, firstId)).thread.ownCopy;
        const secondCopy = (yield* read(started.missionId, secondId)).thread.ownCopy;
        if (firstCopy === null || secondCopy === null) return yield* Effect.die(new Error("missing ownCopy"));

        // Deleting both worktrees while leaving the realm folder intact holds both errands when messaged.
        rmSync(firstCopy.path, { recursive: true });
        rmSync(secondCopy.path, { recursive: true });
        yield* call({ _tag: "SendMessage", delivery: null, requestId: "m1", text: "Continue.", threadId: firstId });
        yield* call({ _tag: "SendMessage", delivery: null, requestId: "m2", text: "Continue.", threadId: secondId });
        yield* settle(started.missionId, (detail) =>
          [firstId, secondId].every((id) => detail.threads.find((t) => t.id === id)?.state === "Attention"),
        );

        const heldFirst = (yield* read(started.missionId, firstId)).thread;
        expect(heldFirst.blocker).toBe("MissingWorkspace");
        expect(heldFirst.workspace?.isMissing).toBe(false);
        expect(heldFirst.ownCopy).toMatchObject({ isMissing: true, path: firstCopy.path });

        // Marking the second errand done must not wake the first fulfilled errand back into Attention.
        yield* call({ _tag: "MarkThreadDone", threadId: firstId });
        yield* call({ _tag: "MarkThreadDone", threadId: secondId });
        yield* Effect.sleep("100 millis");
        const after = yield* read(started.missionId, firstId);
        expect(after.threads.find((t) => t.id === firstId)?.state).toBe("Fulfilled");
        expect(after.threads.find((t) => t.id === secondId)?.state).toBe("Fulfilled");
      }).pipe(Effect.provide(layer));
    },
  );
});
