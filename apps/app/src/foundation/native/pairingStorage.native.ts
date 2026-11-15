import type { KeyValueStorage } from "@outlore/controller";
import { deleteItemAsync, getItem, setItem } from "expo-secure-store";

/**
 * Where the mobile app keeps its pairings: the host's key, room and device token go into the phone's secure store
 * (Android Keystore), not a plain file. The store has no synchronous delete, so a removed key is first emptied, which
 * reads back as absent, and then deleted.
 */
export const pairingStorage = (): KeyValueStorage => ({
  getItem: (key) => {
    const value = getItem(key);
    return value === "" ? null : value;
  },
  removeItem: (key) => {
    setItem(key, "");
    deleteItemAsync(key).catch(() => void 0);
  },
  setItem: (key, value) => setItem(key, value),
});
