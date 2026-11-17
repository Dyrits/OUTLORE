import { sha256 } from "@noble/hashes/sha2.js";
import { randomBytes } from "@noble/hashes/utils.js";

export const deviceTokenBytes = 32;

/** A fresh secret a host gives a paired device so it can resume; 32 random bytes. */
export function newDeviceToken(): Uint8Array {
  return randomBytes(deviceTokenBytes);
}

/** The SHA-256 of a token: the host stores only this, never the token. */
export function hashToken(token: Uint8Array): Uint8Array {
  return sha256(token);
}
