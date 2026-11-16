import { describe, expect, it } from "@effect/vitest";
import { runnerOf } from "../../src/harness/index.ts";

describe("choosing a thread's runner", () => {
  it("keeps the parent's account and model on the parent's harness", () => {
    const parent = { accountId: "work", effort: "high", harness: "codex", model: "gpt-x" } as const;
    expect(runnerOf(parent, {})).toEqual(parent);
    expect(runnerOf(parent, { effort: "low" })).toEqual({ ...parent, effort: "low" });
  });

  it("takes another harness's own sign-in and default model unless chosen", () => {
    const parent = { accountId: "work", effort: "high", harness: "codex", model: "gpt-x" } as const;
    expect(runnerOf(parent, { harness: "claude" })).toEqual({
      accountId: null,
      effort: "high",
      harness: "claude",
      model: "default",
    });
    expect(runnerOf(parent, { accountId: "other", harness: "claude", model: "opus" })).toEqual({
      accountId: "other",
      effort: "high",
      harness: "claude",
      model: "opus",
    });
  });

  it("takes the computer's own sign-in when the account is chosen as null", () => {
    const parent = { accountId: "work", effort: "high", harness: "codex", model: "gpt-x" } as const;
    expect(runnerOf(parent, { accountId: null }).accountId).toBeNull();
  });
});
