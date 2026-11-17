import { describe, expect, it } from "vitest";
import { type SecureStore, secureStorageOf } from "../../../src/foundation/native/secureStorage";

// The mobile app keeps its pairings in the phone's secure store, whose reads and writes are synchronous but which has no
// synchronous delete: a removed key must read back as absent at once (browser access on a phone).
const fakeSecureStoreOf = (): SecureStore & { readonly entries: Map<string, string> } => {
  const entries = new Map<string, string>();
  return {
    deleteItemAsync: (key) => new Promise<void>((resolve) => setTimeout(() => resolve(void entries.delete(key)), 0)),
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
  };
};

describe("keeping the mobile app's pairings in the secure store", () => {
  it("keeps a value and reads it back", () => {
    const storage = secureStorageOf(fakeSecureStoreOf());
    storage.setItem("outlore.browserHost", "host-1");
    expect(storage.getItem("outlore.browserHost")).toBe("host-1");
  });

  it("reads a removed key as absent at once, before the store's own delete has finished", () => {
    const store = fakeSecureStoreOf();
    const storage = secureStorageOf(store);
    storage.setItem("outlore.browserHost", "host-1");
    storage.removeItem("outlore.browserHost");
    expect(store.entries.has("outlore.browserHost")).toBe(true);
    expect(storage.getItem("outlore.browserHost")).toBeNull();
  });

  it("reads a key never written as absent", () => {
    expect(secureStorageOf(fakeSecureStoreOf()).getItem("never")).toBeNull();
  });
});
