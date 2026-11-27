import type { Tier } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { entriesOf, panelLayoutOf, splitLeastWidth, withBackups, withRunner } from "../../src/editors/presetEntries";
import { type Preset, presetChangeOf } from "../../src/editors/presets";

const codex = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" } as const;
const claude = (model: string, backups: Tier["backups"] = []): Tier => ({
  accountId: null,
  backups,
  effort: "default",
  harness: "claude",
  model,
});
const presetOf = (name: string, tier: Tier): Preset => {
  const { backups, ...runner } = tier;
  return { backups, name, runner };
};
const light = presetOf("Light", claude("claude-haiku-5-5"));
const heavy = presetOf("Heavy", claude("claude-opus-5-5", [codex]));

describe("the entries of the preset list", () => {
  it("marks the preset whose whole stack the thread has", () => {
    const entries = entriesOf([light, heavy], presetChangeOf(heavy));
    expect(entries).toEqual([
      { isChosen: false, preset: light },
      { isChosen: true, preset: heavy },
    ]);
  });

  it("marks no preset and adds no Custom entry when the stack matches none", () => {
    const entries = entriesOf([light, heavy], claude("claude-sonnet-5-5"));
    expect(entries).toEqual([
      { isChosen: false, preset: light },
      { isChosen: false, preset: heavy },
    ]);
  });

  it("marks no preset when the Companion matches a preset but the backups do not", () => {
    const entries = entriesOf([light, heavy], claude("claude-opus-5-5"));
    expect(entries.some((entry) => entry.isChosen)).toBe(false);
  });

  it("marks nothing while the backups are unread", () => {
    const entries = entriesOf([light, heavy], null);
    expect(entries).toHaveLength(2);
    expect(entries.some((entry) => entry.isChosen)).toBe(false);
  });

  it("is empty without presets", () => {
    expect(entriesOf([], claude("claude-sonnet-5-5"))).toEqual([]);
  });

  it("marks only the first of two presets with the same stack", () => {
    const twin = presetOf("Twin", claude("claude-haiku-5-5"));
    const entries = entriesOf([light, twin], presetChangeOf(light));
    expect(entries.map((entry) => entry.isChosen)).toEqual([true, false]);
  });
});

describe("the layout of the Companions tab", () => {
  it("stacks the sections until the panel has measured itself", () => {
    expect(panelLayoutOf(null)).toBe("stacked");
  });

  it("stacks in the mini panel and the default column, and splits from the least width up", () => {
    expect(splitLeastWidth).toBe(480);
    expect(panelLayoutOf(288)).toBe("stacked");
    expect(panelLayoutOf(360)).toBe("stacked");
    expect(panelLayoutOf(splitLeastWidth - 1)).toBe("stacked");
    expect(panelLayoutOf(splitLeastWidth)).toBe("split");
    expect(panelLayoutOf(900)).toBe("split");
  });
});

describe("editing a preset's stack", () => {
  it("changes the primary Companion and keeps the backups", () => {
    const next = withRunner(presetChangeOf(heavy), { ...claude("claude-sonnet-5-5"), effort: "high" });
    expect(next).toEqual({ ...claude("claude-sonnet-5-5", [codex]), effort: "high" });
  });

  it("changes the backups and keeps the primary Companion", () => {
    expect(withBackups(presetChangeOf(heavy), [])).toEqual(claude("claude-opus-5-5"));
  });
});
