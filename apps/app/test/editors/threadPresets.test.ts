import type { Request, Settings, Tier } from "@outlore/contracts";
import { describe, expect, it, vi } from "vitest";
import { entriesOf } from "../../src/editors/presetEntries";
import { presetChangeOf } from "../../src/editors/presets";
import { presetChoiceOf } from "../../src/editors/useThreadPresets";

const claude = (model: string, backups: Tier["backups"] = []): Tier => ({
  accountId: null,
  backups,
  effort: "default",
  harness: "claude",
  model,
});
const settingsOf = (heavy: Tier) =>
  ({
    companionPresets: { custom: [], tierNames: {} },
    tiers: { Balanced: null, Heavy: heavy, Light: null },
  }) as unknown as Settings;

const clientOf = () => {
  const sent: Request[] = [];
  return { request: vi.fn(async (request: Request) => void sent.push(request)), sent };
};

describe("editing a preset from a thread's Companions tab", () => {
  it("saves the preset's new stack and never changes the thread's Companion", async () => {
    const client = clientOf();
    const threadStack = claude("claude-opus-5-5");
    const choice = presetChoiceOf(client, "thread-1" as never, settingsOf(threadStack), [], () => {});
    const edited = claude("claude-sonnet-5-5");
    await choice.onOverwritePreset?.("Heavy", edited);
    expect(client.sent).toEqual([
      { _tag: "ChangeCompanionPreset", edit: { _tag: "SetStack", name: "Heavy", stack: edited } },
    ]);
    expect(client.sent.some((request) => request._tag === "ChangeThreadRunner")).toBe(false);
  });

  it("moves a thread that was on the preset to Custom, and pressing the preset's row hands it over", async () => {
    const client = clientOf();
    const threadStack = claude("claude-opus-5-5");
    const before = presetChoiceOf(client, "thread-1" as never, settingsOf(threadStack), [], () => {});
    expect(entriesOf(before.presets, threadStack).map((entry) => [entry.kind, entry.isChosen])).toEqual([
      ["preset", true],
    ]);
    // The host now holds the edited preset; the thread keeps the stack it had.
    const after = presetChoiceOf(client, "thread-1" as never, settingsOf(claude("claude-sonnet-5-5")), [], () => {});
    expect(entriesOf(after.presets, threadStack).map((entry) => [entry.kind, entry.isChosen])).toEqual([
      ["preset", false],
      ["custom", true],
    ]);
    const [edited] = after.presets;
    if (edited === undefined) throw new Error("Missing preset");
    after.onPreset(edited);
    await Promise.resolve();
    expect(client.sent).toEqual([{ _tag: "ChangeThreadRunner", ...presetChangeOf(edited), threadId: "thread-1" }]);
  });
});
