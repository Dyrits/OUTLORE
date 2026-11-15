import { getRandomValues, randomUUID } from "expo-crypto";

// Hermes has no `crypto`, which the encrypted channel's random bytes (`@noble/hashes`) and a pairing's identifier read
// from the global. Only what the app uses is provided: it needs no `crypto.subtle`, which only the relay Worker uses.
if (typeof globalThis.crypto?.getRandomValues !== "function") {
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: { getRandomValues, randomUUID },
  });
}
