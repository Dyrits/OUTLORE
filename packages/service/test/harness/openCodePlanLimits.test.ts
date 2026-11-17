import { describe, expect, it } from "vitest";
import { openCodePlanLimitsOf } from "../../src/harness/opencode.ts";

// The usage.limits answer as OpenCode 2.2.0 served it (probe of 2026-11-12): data.go holds the Go plan's three
// windows, each with a used percent and a reset time in milliseconds.
const answer = {
  data: {
    budgets: [],
    go: {
      monthly: { limited: false, percent: 7, resetsAt: 1796315927000 },
      rolling: { limited: false, percent: 12, resetsAt: 1794481927000 },
      weekly: { limited: false, percent: 40, resetsAt: 1794787200000 },
    },
    workspace: { id: "wrk_1", name: "Default", usageURL: "https://example.invalid/usage" },
  },
  location: {},
};

describe("plan limits from OpenCode's usage.limits answer", () => {
  it("reads the Go plan's three windows in its order, as used percents with reset times in seconds", () => {
    expect(openCodePlanLimitsOf(answer)).toEqual({
      billing: "Subscription",
      windows: [
        { resetsAtSeconds: 1794481927, usedPercent: 12, windowMinutes: 300 },
        { resetsAtSeconds: 1794787200, usedPercent: 40, windowMinutes: 10_080 },
        { resetsAtSeconds: 1796315927, usedPercent: 7, windowMinutes: 43_200 },
      ],
    });
  });

  it("keeps the windows the answer reports when others are missing", () => {
    const only = { data: { go: { rolling: answer.data.go.rolling } } };
    expect(openCodePlanLimitsOf(only)?.windows).toEqual([
      { resetsAtSeconds: 1794481927, usedPercent: 12, windowMinutes: 300 },
    ]);
  });

  it("reports nothing for an answer with no Go plan, no data, or unreadable windows", () => {
    expect(openCodePlanLimitsOf({ data: null })).toBeNull();
    expect(openCodePlanLimitsOf({ data: { budgets: [] } })).toBeNull();
    expect(openCodePlanLimitsOf({ data: { go: { rolling: { percent: "x" } } } })).toBeNull();
    expect(openCodePlanLimitsOf(null)).toBeNull();
  });
});
