import type { Tier } from "@outlore/contracts";
import { describe, expect, it, vi } from "vitest";
import { workshopDraft, workshopKept } from "../../src/settings/workshopDraft";

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
});
