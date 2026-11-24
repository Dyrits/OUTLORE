import { describe, expect, it } from "vitest";
import { folderMoveOf, mightMoveFolder } from "../../src/work/folderMoves.ts";

const checkout = "/code/app";
const home = "/home/dev";
const bash = (command: string, from = checkout) => folderMoveOf("Bash", { command }, from, checkout, home);

describe("where a shell command moves the thread's shell", () => {
  it("follows a cd to an absolute path, and a relative one from the previous folder", () => {
    expect(bash("cd /code/app/.worktrees/fix")).toBe("/code/app/.worktrees/fix");
    expect(bash("cd ../elsewhere", "/code/app/.worktrees/fix")).toBe("/code/app/.worktrees/elsewhere");
    expect(bash("cd .worktrees/fix")).toBe("/code/app/.worktrees/fix");
  });

  it("reads quotes, a home shorthand, and the folder a command runs after `&&`", () => {
    expect(bash('cd "/code/app/.worktrees/my fix" && bun test')).toBe("/code/app/.worktrees/my fix");
    expect(bash("cd '/code/app/.worktrees/my fix'")).toBe("/code/app/.worktrees/my fix");
    expect(bash("cd ~/work/app")).toBe("/home/dev/work/app");
    expect(bash("echo hi; cd .worktrees/fix; ls")).toBe("/code/app/.worktrees/fix");
  });

  it("follows a git worktree add, with git -C and its options", () => {
    expect(bash("git worktree add .worktrees/fix")).toBe("/code/app/.worktrees/fix");
    expect(bash("git worktree add -b mission/fix .worktrees/fix main")).toBe("/code/app/.worktrees/fix");
    expect(bash("git -C /code/app worktree add ../app-fix")).toBe("/code/app-fix");
    expect(bash("git worktree add --detach /tmp/scratch HEAD")).toBe("/tmp/scratch");
  });

  it("moves nothing for a cd it cannot follow, or one that runs outside the thread's own shell", () => {
    expect(bash("cd")).toBeUndefined();
    expect(bash("cd -")).toBeUndefined();
    expect(bash("cd $HOME/app")).toBeUndefined();
    expect(bash('cd "$(git rev-parse --show-toplevel)"')).toBeUndefined();
    expect(bash("cd .worktrees/*")).toBeUndefined();
    expect(bash("(cd .worktrees/fix && make)")).toBeUndefined();
    expect(bash("cd .worktrees/fix | tee log")).toBeUndefined();
    expect(bash("cd .worktrees/fix &")).toBeUndefined();
    expect(bash("false || cd .worktrees/fix")).toBeUndefined();
    expect(bash("echo 'cd .worktrees/fix'")).toBeUndefined();
    expect(bash("# cd .worktrees/fix")).toBeUndefined();
    expect(bash("git worktree list")).toBeUndefined();
    expect(bash("git status")).toBeUndefined();
  });

  it("follows a cd on the left of `||`, which always runs", () => {
    expect(bash("cd .worktrees/fix || echo no")).toBe("/code/app/.worktrees/fix");
  });

  it("moves nothing when the command ends where it began", () => {
    expect(bash("cd /code/app")).toBeUndefined();
    expect(bash("cd .worktrees/fix && cd ../..")).toBeUndefined();
  });

  it("reads OpenCode's lower-case shell tool the same way", () => {
    expect(folderMoveOf("bash", { command: "cd .worktrees/fix" }, checkout, checkout, home)).toBe(
      "/code/app/.worktrees/fix",
    );
  });
});

describe("where Claude Code's worktree tools move the thread's shell", () => {
  it("enters a worktree by its path, or by the name Claude Code makes it under", () => {
    expect(folderMoveOf("EnterWorktree", { path: "/code/app/.worktrees/fix" }, checkout, checkout)).toBe(
      "/code/app/.worktrees/fix",
    );
    expect(folderMoveOf("EnterWorktree", { path: ".worktrees/fix" }, checkout, checkout)).toBe(
      "/code/app/.worktrees/fix",
    );
    expect(folderMoveOf("EnterWorktree", { name: "fix" }, checkout, checkout)).toBe("/code/app/.claude/worktrees/fix");
    expect(folderMoveOf("EnterWorktree", {}, checkout, checkout)).toBeUndefined();
  });

  it("goes back to where the thread started on ExitWorktree", () => {
    expect(folderMoveOf("ExitWorktree", {}, "/code/app/.worktrees/fix", checkout)).toBeNull();
  });
});

describe("telling calls that might move the shell from those that cannot", () => {
  it("looks into a shell command only when it names cd, pushd or worktree", () => {
    expect(mightMoveFolder("Bash", { command: "cd x" })).toBe(true);
    expect(mightMoveFolder("Bash", { command: "git worktree add x" })).toBe(true);
    expect(mightMoveFolder("Bash", { command: "ls -la" })).toBe(false);
    expect(mightMoveFolder("Read", { command: "cd x" })).toBe(false);
    expect(mightMoveFolder("EnterWorktree", {})).toBe(true);
    expect(mightMoveFolder("ExitWorktree", {})).toBe(true);
  });
});
