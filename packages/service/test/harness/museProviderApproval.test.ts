import { describe, expect, it } from "vitest";
import { museApprovalChoice } from "../../src/harness/museProtocol.ts";

describe("Muse approval choices", () => {
  const choices = [
    { choiceId: "always", decision: "approved", scope: "always" },
    { choiceId: "once", decision: "approved", scope: "once" },
    { choiceId: "deny", decision: "denied", scope: "once" },
  ];

  it("only grants the requested action once", () => {
    expect(museApprovalChoice(choices, true)).toBe("once");
    expect(museApprovalChoice(choices.slice(0, 1), true)).toBeNull();
  });

  it("denies or aborts without granting when refused", () => {
    expect(museApprovalChoice(choices, false)).toBe("deny");
    expect(museApprovalChoice([{ choiceId: "stop", decision: "abort", scope: "once" }], false)).toBe("stop");
    expect(museApprovalChoice(choices.slice(0, 2), false)).toBeNull();
  });
});
