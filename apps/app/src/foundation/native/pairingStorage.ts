import type { KeyValueStorage } from "@outlore/controller";

/** Where this device keeps its pairings: the browser's own storage on the web build. */
export const pairingStorage = (): KeyValueStorage => window.localStorage;
