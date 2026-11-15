import { describe, expect, it } from "vitest";
import { approvalInstructionsOf } from "../../src/harness/index.ts";

const access = {
  approvalLevel: "RiskyOnly",
  canWorkOutsideSandbox: false,
  isInWorkspace: true,
  mcpUrl: "",
  permissions: [],
  unaskedTools: [],
} as const;

describe("telling a thread where it may work unasked", () => {
  it("names the folder and the workspace's git worktrees as work that needs no escape", () => {
    const text = approvalInstructionsOf(access, true, "claude");
    expect(text).toContain("worktrees");
    expect(text).toContain("Do not run a command outside the sandbox for work in them");
  });

  it("tells a thread to make a worktree inside its folder or in its temporary folder, never beside it", () => {
    const text = approvalInstructionsOf(access, true, "claude");
    expect(text).toContain(".worktrees/<name>");
    expect(text).toContain("$TMPDIR");
    expect(text).toContain("never as a sibling folder");
  });

  it("gives the same advice to a thread whose harness has no sandbox here", () => {
    const text = approvalInstructionsOf(access, false, "claude");
    expect(text).toContain(".worktrees/<name>");
  });

  it("tells a thread it may leave the sandbox without asking once the owner allowed it, and still to ask before consequential actions", () => {
    const text = approvalInstructionsOf({ ...access, canWorkOutsideSandbox: true }, true, "claude");
    expect(text).toContain("The owner has allowed you to work outside the sandbox");
    expect(text).not.toContain("asks the owner about that exact command");
    expect(text).toContain("Before one, call the request_approval tool");
    const normal = approvalInstructionsOf(access, true, "claude");
    expect(normal).toContain("asks the owner about that exact command");
    expect(normal).not.toContain("The owner has allowed you to work outside the sandbox");
  });
});
