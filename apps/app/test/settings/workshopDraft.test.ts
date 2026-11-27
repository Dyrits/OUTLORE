import type { Tier } from "@outlore/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  draftSeedOf,
  renamedFocusOf,
  workshopDraft,
  workshopKept,
  workshopSaving,
} from "../../src/settings/workshopDraft";

const stack: Tier = { accountId: null, backups: [], effort: "high", harness: "claude", model: "opus" };

describe("the Workshop's draft preset", () => {
  it("tells whoever watches it, the Companions tab outside the page's providers, when it starts and ends", () => {
    const heard = vi.fn();
    const stop = workshopDraft.subscribe(heard);
    workshopDraft.set(stack);
    expect(workshopDraft.get()).toBe(stack);
    workshopDraft.set(null);
    expect(workshopDraft.get()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    workshopDraft.set(stack);
    expect(heard).toHaveBeenCalledTimes(2);
    workshopDraft.set(null);
  });

  it("keeps each Companion's unsaved chain for the tab to read again after it shows another Companion", () => {
    const heard = vi.fn();
    const stop = workshopKept.subscribe(heard);
    workshopKept.set((current) => ({
      ...current,
      "custom:Mine": { editedFrom: stack, value: { ...stack, effort: "low" } },
    }));
    expect(workshopKept.get()["custom:Mine"]?.value.effort).toBe("low");
    workshopKept.set(() => ({}));
    expect(workshopKept.get()).toEqual({});
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps a built-in tier's focus on rename and moves only custom presets to the new custom key", () => {
    expect(renamedFocusOf("Light", "Lighter")).toBe("Light");
    expect(renamedFocusOf("Heavy", "Deep")).toBe("Heavy");
    expect(renamedFocusOf("custom:Mine", "Renamed")).toBe("custom:Renamed");
  });

  it("seeds a new preset draft from the selected live draft, then Default's full stack or the preset's saved stack", () => {
    const defaults = { accountId: null, effort: "default" as const, harness: "claude" as const, model: "sonnet" };
    const backup = { accountId: null, effort: "low" as const, harness: "codex" as const, model: "gpt-5" };
    const defaultStack: Tier = { ...defaults, backups: [backup] };
    const liveDraft: Tier = { ...stack, model: "opus-draft" };
    expect(draftSeedOf({ defaultStack, defaults, drafts: { Light: liveDraft }, selected: "Light", stack })).toEqual(
      liveDraft,
    );
    expect(draftSeedOf({ defaultStack, defaults, drafts: {}, selected: "Default", stack: null })).toEqual(defaultStack);
    expect(draftSeedOf({ defaultStack, defaults, drafts: {}, selected: "Light", stack: null })).toEqual({
      ...defaults,
      backups: [],
    });
  });

  it("keeps a preset locked as saving across remounts until its delayed save settles", async () => {
    const deferred = { resolve: () => {} };
    const pending = workshopSaving.track(
      "Light",
      () =>
        new Promise<void>((resolve) => {
          deferred.resolve = resolve;
        }),
    );
    expect(workshopSaving.isSaving("Light")).toBe(true);
    expect(workshopSaving.isSaving("Heavy")).toBe(false);
    deferred.resolve();
    await pending;
    expect(workshopSaving.isSaving("Light")).toBe(false);
  });
});
