import type { ThreadView } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { missingFolderOf } from "../../src/realms/missingFolder";

const existingWorkspace = { isMissing: false, path: "/code/app" } as ThreadView["workspace"];
const missingWorkspace = { isMissing: true, path: "/code/app" } as ThreadView["workspace"];
const ownCopy = { branch: "mission/fix-1", isMissing: true, path: "/code/app/.worktrees/fix-1" };

describe("missingFolderOf", () => {
  it("names the own copy when the realm folder still exists", () => {
    expect(missingFolderOf({ ownCopy, workspace: existingWorkspace })).toEqual({
      isOwnCopy: true,
      path: "/code/app/.worktrees/fix-1",
    });
  });

  it("names the realm folder when the realm folder itself is missing", () => {
    expect(missingFolderOf({ ownCopy, workspace: missingWorkspace })).toEqual({
      isOwnCopy: false,
      path: "/code/app",
    });
    expect(missingFolderOf({ ownCopy: null, workspace: missingWorkspace })).toEqual({
      isOwnCopy: false,
      path: "/code/app",
    });
  });

  it("falls back to the realm folder when there is no own copy", () => {
    expect(missingFolderOf({ ownCopy: null, workspace: existingWorkspace })).toEqual({
      isOwnCopy: false,
      path: "/code/app",
    });
  });

  it("returns null when the thread has neither realm nor own copy", () => {
    expect(missingFolderOf({ ownCopy: null, workspace: null })).toBeNull();
  });
});
