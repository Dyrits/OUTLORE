import { describe, expect, it } from "vitest";
import type { CompanionPickerProps } from "../../src/editors/companionPicker";
import { createCompanionRegistry } from "../../src/shell/companionRegistry";

const picker = (isChronicler = false): CompanionPickerProps => ({
  accountId: null,
  effort: "default",
  effortOptions: [],
  harness: "claude",
  harnesses: null,
  isAccountShown: false,
  isChronicler,
  model: "default",
  onEffort: () => {},
  onModel: () => {},
});
const mount = (registry: ReturnType<typeof createCompanionRegistry>, id: string, isChronicler = false, rank = 0) => {
  registry.register(id);
  registry.publish(id, picker(isChronicler), rank);
};

describe("choosing the dock's Companion", () => {
  it("uses rank first and newest registration for a tie", () => {
    const registry = createCompanionRegistry();
    mount(registry, "first", false, 1);
    mount(registry, "second", false, 0);
    expect(registry.selected(null, false, true).pillId).toBe("second");
    mount(registry, "third", false, 0);
    expect(registry.selected(null, false, true).pillId).toBe("third");
  });
  it("never substitutes a different page picker for an unmounted selected page", () => {
    const registry = createCompanionRegistry();
    mount(registry, "page");
    mount(registry, "other");
    const content = registry.choose("page");
    registry.unregister("page");
    expect(registry.selected(content, false, true).companionPicker).toBeNull();
  });
  it("follows Chronicler across a remount and scopes out hidden pickers", () => {
    const registry = createCompanionRegistry();
    mount(registry, "page");
    mount(registry, "chronicler", true);
    const content = registry.choose("chronicler");
    registry.unregister("chronicler");
    mount(registry, "restored", true);
    expect(registry.selected(content, true, true).pillId).toBe("restored");
    expect(registry.selected(content, false, false).companionPicker).toBeNull();
    expect(registry.selected(null, true, true).pillId).toBe("restored");
  });
  it("routes an already drawn picker's actions to newly published handlers", () => {
    const registry = createCompanionRegistry();
    mount(registry, "page");
    const drawn = registry.selected(registry.choose("page"), false, true).companionPicker;
    const calls: string[] = [];
    expect(
      registry.publish(
        "page",
        { ...picker(), onEffort: () => calls.push("live effort"), onModel: () => calls.push("live model") },
        0,
      ),
    ).toBe(false);
    drawn?.onEffort("default");
    drawn?.onModel("claude", null, "default");
    expect(calls).toEqual(["live effort", "live model"]);
    registry.unregister("page");
    drawn?.onEffort("default");
    expect(calls).toHaveLength(2);
  });
  it("ignores late publication and choices after unregistration", () => {
    const registry = createCompanionRegistry();
    expect(registry.publish("missing", picker(), 0)).toBe(false);
    expect(registry.choose("missing")).toBeNull();
    expect(registry.selected(null, false, true).hasCompanion).toBe(false);
  });
});
