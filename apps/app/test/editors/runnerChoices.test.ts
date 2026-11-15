import type { HarnessList } from "@outlore/contracts";
import { expect, it } from "vitest";
import { changedHarnessOf, companionOf, keptOptionsOf } from "../../src/editors/runnerChoices";
import type { Runner } from "../../src/editors/runners";

const harnesses: HarnessList = {
  harnesses: [
    {
      accounts: [],
      models: [
        { efforts: ["high"], id: "first", label: "First" },
        { efforts: ["low"], id: "second", label: "Second" },
      ],
      name: "codex",
      problem: null,
      update: null,
      version: "1",
    },
  ],
};
const value: Runner = { accountId: null, effort: "high", harness: "claude", model: "old" };
it("changes harness to its first model and retains supported effort", () => {
  expect(changedHarnessOf(harnesses, value, "codex")).toEqual({
    accountId: null,
    effort: "high",
    harness: "codex",
    model: "first",
  });
  expect(changedHarnessOf(harnesses, value, "claude")).toBe(value);
  expect(changedHarnessOf(null, value, "codex")).toMatchObject({ effort: "default", model: "default" });
});
it("falls back to default effort when a companion does not offer the old level", () => {
  expect(companionOf(harnesses, value, "codex", null, "second").effort).toBe("default");
});
it("keeps a removed account or model as an option without duplicating it", () => {
  expect(keptOptionsOf(["own"], "removed")).toEqual(["own", "removed"]);
  expect(keptOptionsOf(["own"], "own")).toEqual(["own"]);
});
