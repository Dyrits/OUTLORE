import { describe, expect, it } from "vitest";
import { approvalInstructionsOf } from "../../src/harness/index.ts";

const access = {
  approvalLevel: "RiskyOnly",
  canWorkOutsideSandbox: false,
  containment: "Sandboxed",
  permissionKinds: [],
} as const;
const unprotected = { ...access, containment: "Unprotected" } as const;

describe("telling a thread where it may work unasked", () => {
  it("names the folder and the workspace's git worktrees as work that needs no escape", () => {
    const text = approvalInstructionsOf(access, "claude");
    expect(text).toContain("worktrees");
    expect(text).toContain("Do not run a command outside the sandbox for work in them");
  });

  it("tells a thread to make a worktree inside its folder or in its temporary folder, never beside it", () => {
    const text = approvalInstructionsOf(access, "claude");
    expect(text).toContain(".worktrees/<name>");
    expect(text).toContain("$TMPDIR");
    expect(text).toContain("never as a sibling folder");
  });

  it("gives the same advice to a thread whose harness has no sandbox here", () => {
    const text = approvalInstructionsOf(unprotected, "claude");
    expect(text).toContain(".worktrees/<name>");
  });

  it("tells a thread it may leave the sandbox without asking once the owner allowed it, and still to ask before consequential actions", () => {
    const text = approvalInstructionsOf({ ...access, canWorkOutsideSandbox: true }, "claude");
    expect(text).toContain("The owner has allowed you to work outside the sandbox");
    expect(text).not.toContain("asks the owner about that exact command");
    expect(text).toContain("Before one, call the request_approval tool");
    const normal = approvalInstructionsOf(access, "claude");
    expect(normal).toContain("asks the owner about that exact command");
    expect(normal).not.toContain("The owner has allowed you to work outside the sandbox");
  });
});

describe("telling a thread its standing permissions", () => {
  it("names each kind of standing permission once, with no target or count, and says what a covered action does", () => {
    const text = approvalInstructionsOf(
      { ...access, permissionKinds: ["Run outside the sandbox", "Run this exact command"] },
      "claude",
    );
    expect(text).toContain(
      "The owner has granted standing permissions of these kinds: Run outside the sandbox; Run this exact command.",
    );
    expect(text).toContain(
      "an action a standing permission covers runs without asking, and anything else asks the owner",
    );
    expect(text).not.toContain("for these exact actions only");
  });

  it("says when the owner has granted none", () => {
    expect(approvalInstructionsOf(access, "claude")).toContain("The owner has granted no standing permissions.");
  });

  it("gives Claude Code's sandbox advice only to Claude Code, and only where its sandbox runs", () => {
    expect(approvalInstructionsOf(unprotected, "claude")).not.toContain("dangerouslyDisableSandbox set to true");
    expect(approvalInstructionsOf(access, "codex")).not.toContain("Claude Code's sandbox");
    expect(approvalInstructionsOf(access, "opencode")).not.toContain("Claude Code's sandbox");
  });
});
