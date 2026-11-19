import { describe, expect, it } from "@effect/vitest";
import { callDescriptionOf } from "../../src/work/activities.ts";

describe("describing a thread's tool calls", () => {
  it("calls an Outlore tool by its name", () => {
    expect(callDescriptionOf("mcp__outlore__update_journal", { entry: "x" })).toEqual({
      detail: "update journal",
      summary: "Use an Outlore tool",
    });
  });

  it("shows a run of Code Mode's code as such, not as one more Outlore tool", () => {
    expect(callDescriptionOf("mcp__outlore__run_code", { code: "async () => 1" })).toEqual({
      detail: "run code",
      summary: "Run code that calls its tools",
    });
  });

  it("leaves out the approval tools, which have lines of their own", () => {
    expect(callDescriptionOf("mcp__outlore__request_approval", {})).toBeNull();
  });

  it("leaves out a choice question, which the conversation shows as bubbles with the answers", () => {
    expect(callDescriptionOf("AskUserQuestion", { questions: [] })).toBeNull();
  });
});
