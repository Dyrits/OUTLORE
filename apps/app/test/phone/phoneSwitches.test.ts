import type { KeyValueStorage } from "@outlore/controller";
import { describe, expect, it } from "vitest";
import { createPhoneSwitches } from "../../src/phone/phoneSwitches";

const fakeStorage = (initial: Record<string, string> = {}): KeyValueStorage & { values: Map<string, string> } => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
    values,
  };
};

describe("phone switches", () => {
  it("keeps every group off by default", () => {
    expect(createPhoneSwitches(fakeStorage()).groups()).toEqual([]);
  });

  it("turns a group on and off and keeps the groups in the card's order", () => {
    const switches = createPhoneSwitches(fakeStorage());
    switches.set("Notify", true);
    switches.set("Information", true);
    expect(switches.groups()).toEqual(["Information", "Notify"]);
    switches.set("Information", false);
    expect(switches.groups()).toEqual(["Notify"]);
  });

  it("reads what an earlier session stored from the phone's own storage", () => {
    const storage = fakeStorage();
    createPhoneSwitches(storage).set("Location", true);
    expect(createPhoneSwitches(storage).groups()).toEqual(["Location"]);
  });

  it("reads damaged or unknown stored values as off", () => {
    expect(createPhoneSwitches(fakeStorage({ "outlore.phoneGroups": "not json" })).groups()).toEqual([]);
    expect(createPhoneSwitches(fakeStorage({ "outlore.phoneGroups": '["Camera","Open",3]' })).groups()).toEqual([
      "Open",
    ]);
  });

  it("tells a listener about each change, and not after it unsubscribes", () => {
    const switches = createPhoneSwitches(fakeStorage());
    const heard: Array<ReadonlyArray<string>> = [];
    const unsubscribe = switches.subscribe(() => heard.push(switches.groups()));
    switches.set("Open", true);
    unsubscribe();
    switches.set("Notify", true);
    expect(heard).toEqual([["Open"]]);
  });

  it("does not announce a change that leaves the groups as they were", () => {
    const switches = createPhoneSwitches(fakeStorage());
    let count = 0;
    switches.subscribe(() => count++);
    switches.set("Open", false);
    expect(count).toBe(0);
  });
});
