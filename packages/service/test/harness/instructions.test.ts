import { describe, expect, it } from "vitest";
import {
  approvalInstructionsOf,
  guildmasterInstructionsOf,
  noToolServerInstructions,
  threadInstructionsOf,
} from "../../src/harness/index.ts";

const access = {
  approvalLevel: "RiskyOnly",
  areEditsUnasked: false,
  canWorkOutsideSandbox: false,
  containment: "Sandboxed",
  isEverythingUnasked: false,
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

  it("tells a thread it may leave the sandbox without asking once the owner allowed it", () => {
    const text = approvalInstructionsOf({ ...access, canWorkOutsideSandbox: true }, "claude");
    expect(text).toContain("The owner has allowed you to work outside the sandbox");
    expect(text).not.toContain("asks the owner about that exact command");
    const normal = approvalInstructionsOf(access, "claude");
    expect(normal).toContain("asks the owner about that exact command");
    expect(normal).not.toContain("The owner has allowed you to work outside the sandbox");
  });

  it("still asks for approval before consequential actions outside the sandbox", () => {
    const text = approvalInstructionsOf({ ...access, canWorkOutsideSandbox: true }, "claude");
    expect(text).toContain("Before one, call the request_approval tool");
  });

  it("routes individual Codex command escapes through the harness in Full access", () => {
    const fullAccess = approvalInstructionsOf({ ...access, canWorkOutsideSandbox: true }, "codex");
    expect(fullAccess).toContain("retry it through Codex's own per-command escalation");
    expect(fullAccess).toContain("Outlore approves that escalation automatically");
    expect(fullAccess).toContain("Before one, call the request_approval tool");
    expect(fullAccess).toContain("A request to widen the sandbox for the turn still asks");
    expect(fullAccess).not.toContain("A worktree you make yourself (git worktree add) asks the owner");
    expect(approvalInstructionsOf(access, "codex")).not.toContain("Outlore approves that escalation automatically");
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

describe("telling a thread how the threads around it work", () => {
  const top = { isAside: false, parent: null, threadId: "t-top", title: "Top" } as const;
  const child = {
    isAside: false,
    parent: { id: "t-top", title: "Top" },
    threadId: "t-child",
    title: "Side",
  } as const;

  it("asks the quest's top thread to name the quest, and an errand to report its result to its opener and name itself", () => {
    expect(threadInstructionsOf(top)).toContain("You are the quest's top thread");
    expect(threadInstructionsOf(top)).toContain("call set_mission_title with a short title");
    expect(threadInstructionsOf(child)).toContain(
      "Thread t-top opened you. When your work is done, call report_result",
    );
    expect(threadInstructionsOf(child)).toContain(
      'If your title is still "Errand", call set_mission_title on your first turn',
    );
  });

  it("uses the quest words for everything written to the owner", () => {
    for (const position of [top, child]) {
      expect(threadInstructionsOf(position)).toContain('never "mission"');
    }
  });

  it("points a thread at Chronicler only while Chronicler's thread exists", () => {
    expect(threadInstructionsOf(child)).not.toContain("Chronicler");
    const withGuildmaster = threadInstructionsOf({ ...child, guildmasterId: "gm-1" });
    expect(withGuildmaster).toContain("send_thread_message to Chronicler, thread gm-1");
  });

  it("teaches a normal thread the off-topic move, and an aside that it answers beside the quest", () => {
    const normal = threadInstructionsOf(child);
    expect(normal).toContain("Call find_missions with the off-topic part");
    expect(normal).not.toContain("You are an aside");
    const aside = threadInstructionsOf({ ...child, isAside: true });
    expect(aside).toContain("You are an aside");
    expect(aside).toContain("send your parent a thread message");
    expect(aside).not.toContain("find_missions");
  });
});

describe("Chronicler's own instructions", () => {
  it("keeps Chronicler out of the work and out of opening quests", () => {
    const text = guildmasterInstructionsOf("gm-1");
    expect(text).toContain("You never do the work yourself");
    expect(text).toContain("You never open a quest yourself");
    expect(text).toContain("You open no threads and keep no journal.");
  });

  it("uses the quest words in everything it writes to the owner", () => {
    expect(guildmasterInstructionsOf("gm-1")).toContain("Say quest, never mission");
  });

  it("names the owner-only permission to work outside the sandbox among the settings it never changes", () => {
    expect(guildmasterInstructionsOf("gm-1")).toContain(
      "Never change the approval level, the budgets, the permission to work outside the sandbox, or price fetching",
    );
  });
});

describe("telling a session that has no Outlore tool server", () => {
  it("names the tools the instructions promised as unavailable and sends the result to the reply", () => {
    expect(noToolServerInstructions).toContain("no Outlore tool server");
    expect(noToolServerInstructions).toContain("request_approval");
    expect(noToolServerInstructions).toContain("report_result");
    expect(noToolServerInstructions).toContain("final reply");
  });
});
