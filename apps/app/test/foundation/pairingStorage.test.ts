import { describe, expect, it, vi } from "vitest";

// The mobile app keeps its pairings in the phone's secure store, whose reads and writes are synchronous but which has no
// synchronous delete: a removed key must read back as absent at once (browser access on a phone).
const store = new Map<string, string>();
vi.mock("expo-secure-store", () => ({
  deleteItemAsync: (key: string) => Promise.resolve(void store.delete(key)),
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
}));

const { pairingStorage } = await import("../../src/foundation/native/pairingStorage.native");

describe("the mobile app's pairing storage", () => {
  it("keeps a value and reads it back", () => {
    const storage = pairingStorage();
    storage.setItem("outlore.browserHost", "host-1");
    expect(storage.getItem("outlore.browserHost")).toBe("host-1");
  });

  it("reads a removed key as absent at once, before the store's own delete has finished", () => {
    const storage = pairingStorage();
    storage.setItem("outlore.browserHost", "host-1");
    storage.removeItem("outlore.browserHost");
    expect(storage.getItem("outlore.browserHost")).toBeNull();
  });

  it("reads a key never written as absent", () => {
    expect(pairingStorage().getItem("never")).toBeNull();
  });
});
