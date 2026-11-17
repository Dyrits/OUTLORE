import type { KeyValueStorage } from "@outlore/controller";

/** The part of the phone's secure store that pairings use: synchronous reads and writes, and only an async delete. */
export type SecureStore = {
  readonly deleteItemAsync: (key: string) => Promise<void>;
  readonly getItem: (key: string) => string | null;
  readonly setItem: (key: string, value: string) => void;
};

/**
 * Pairings kept in a secure store. The store has no synchronous delete, so a removed key is first emptied, which reads
 * back as absent, and then deleted.
 */
export const secureStorageOf = (store: SecureStore): KeyValueStorage => ({
  getItem: (key) => {
    const value = store.getItem(key);
    return value === "" ? null : value;
  },
  removeItem: (key) => {
    store.setItem(key, "");
    // A failed delete is safe to ignore: the emptied value already reads back as absent.
    store.deleteItemAsync(key).catch(() => void 0);
  },
  setItem: (key, value) => store.setItem(key, value),
});
