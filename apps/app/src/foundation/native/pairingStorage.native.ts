import type { KeyValueStorage } from "@outlore/controller";
import { deleteItemAsync, getItem, setItem } from "expo-secure-store";
import { secureStorageOf } from "./secureStorage";

/**
 * Where the mobile app keeps its pairings: the host's key, room and device token go into the phone's secure store
 * (Android Keystore), not a plain file.
 */
export const pairingStorage = (): KeyValueStorage => secureStorageOf({ deleteItemAsync, getItem, setItem });
