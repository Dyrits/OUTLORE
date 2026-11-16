/**
 * Adapted from Paseo (https://github.com/getpaseo/paseo), Apache-2.0, Copyright (c) Mohamed Boudra; modified for Outlore.
 *
 * Noise spec section 5.2 SymmetricState for SHA256 (HASHLEN 32).
 */
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { CipherState } from "./cipherState.ts";

const HASHLEN = 32;
const EMPTY = new Uint8Array(0);

/** The running hash and chaining key of a handshake, with the cipher that protects handshake payloads. */
export class SymmetricState {
  readonly cipher = new CipherState();
  private chainingKey: Uint8Array;
  private hash: Uint8Array;

  constructor(protocolName: string) {
    const name = new TextEncoder().encode(protocolName);
    if (name.byteLength <= HASHLEN) {
      this.hash = new Uint8Array(HASHLEN);
      this.hash.set(name);
    } else {
      this.hash = sha256(name);
    }
    this.chainingKey = this.hash.slice();
    this.cipher.initializeKey(null);
  }

  mixKey(inputKeyMaterial: Uint8Array): void {
    const [chainingKey, tempKey] = hkdf2(this.chainingKey, inputKeyMaterial);
    this.chainingKey = chainingKey;
    this.cipher.initializeKey(tempKey);
  }

  mixHash(data: Uint8Array): void {
    this.hash = sha256(concat(this.hash, data));
  }

  handshakeHash(): Uint8Array {
    return this.hash.slice();
  }

  encryptAndHash(plaintext: Uint8Array): Uint8Array {
    const ciphertext = this.cipher.encryptWithAd(this.hash, plaintext);
    this.mixHash(ciphertext);
    return ciphertext;
  }

  decryptAndHash(ciphertext: Uint8Array): Uint8Array {
    const plaintext = this.cipher.decryptWithAd(this.hash, ciphertext);
    this.mixHash(ciphertext);
    return plaintext;
  }

  split(): [CipherState, CipherState] {
    const [firstKey, secondKey] = hkdf2(this.chainingKey, EMPTY);
    const firstCipher = new CipherState();
    const secondCipher = new CipherState();
    firstCipher.initializeKey(firstKey);
    secondCipher.initializeKey(secondKey);
    this.chainingKey.fill(0);
    this.cipher.clear();
    return [firstCipher, secondCipher];
  }
}

/** Noise spec section 4.3 HKDF with two outputs: an HMAC chain with the info bytes 0x01 and 0x02. */
function hkdf2(chainingKey: Uint8Array, inputKeyMaterial: Uint8Array): [Uint8Array, Uint8Array] {
  const tempKey = hmac(sha256, chainingKey, inputKeyMaterial);
  const output1 = hmac(sha256, tempKey, new Uint8Array([0x01]));
  const output2 = hmac(sha256, tempKey, concat(output1, new Uint8Array([0x02])));
  tempKey.fill(0);
  return [output1, output2];
}

/** Joins byte arrays into one new array. */
export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
}
