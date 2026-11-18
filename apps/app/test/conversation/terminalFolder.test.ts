import type { ThreadView } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { terminalFolderOf } from "../../src/conversation/terminalFolder";

const workspace = { path: "/code/app" } as ThreadView["workspace"];
const ownCopy = { branch: "mission/fix-1", path: "/code/app/.worktrees/fix-1" };

describe("where a thread's terminal starts", () => {
  it("starts in the worktree the thread works in, not in the workspace's checkout", () => {
    expect(terminalFolderOf({ ownCopy, workspace })).toBe("/code/app/.worktrees/fix-1");
  });

  it("starts in the workspace's folder when the thread has no worktree", () => {
    expect(terminalFolderOf({ ownCopy: null, workspace })).toBe("/code/app");
  });

  it("starts in the owner's home for a thread with neither, or while its conversation loads", () => {
    expect(terminalFolderOf({ ownCopy: null, workspace: null })).toBeNull();
    expect(terminalFolderOf(null)).toBeNull();
  });
});
