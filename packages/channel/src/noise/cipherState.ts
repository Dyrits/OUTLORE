/**
 * Adapted from Paseo (https://github.com/getpaseo/paseo), Apache-2.0, Copyright (c) Mohamed Boudra; modified for Outlore.
 *
 * Noise spec section 5.1 CipherState for ChaChaPoly: the nonce is 4 zero bytes then the 64-bit little-endian counter.
 */
import { chacha20poly1305 } from "@noble/ciphers/chacha.js";

/** The length of the authentication tag that ends every encrypted Noise message. */
export const NOISE_TAG_BYTES = 16;
/** The largest Noise message in bytes, tag included. */
export const NOISE_MAX_MESSAGE_BYTES = 65535;
const MAX_NONCE = (1n << 64n) - 1n;

/** A violation of the Noise protocol: bad key, bad turn, failed authentication, exhausted counter. */
export class NoiseProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoiseProtocolError";
  }
}

/** One direction of the transport: a key and the counter that makes each record's nonce unique. */
export class CipherState {
  private key: Uint8Array | null = null;
  private counter = 0n;

  initializeKey(key: Uint8Array | null, nonce = 0n): void {
    this.key = key;
    this.counter = nonce;
  }

  hasKey(): boolean {
    return this.key !== null;
  }

  nonce(): bigint {
    return this.counter;
  }

  encryptWithAd(ad: Uint8Array, plaintext: Uint8Array): Uint8Array {
    if (this.key === null) return plaintext;
    const nonce = this.takeNonce();
    return chacha20poly1305(this.key, nonce, ad).encrypt(plaintext);
  }

  decryptWithAd(ad: Uint8Array, ciphertext: Uint8Array): Uint8Array {
    if (this.key === null) return ciphertext;
    if (this.counter === MAX_NONCE) throw new NoiseProtocolError("nonce exhausted");
    let plaintext: Uint8Array;
    try {
      plaintext = chacha20poly1305(this.key, encodeNonce(this.counter), ad).decrypt(ciphertext);
    } catch {
      throw new NoiseProtocolError("authentication failed");
    }
    // Only a successful authentication advances the receive counter.
    this.counter += 1n;
    return plaintext;
  }

  /** Reserves the next nonce synchronously so concurrent senders never share one. */
  private takeNonce(): Uint8Array {
    if (this.counter === MAX_NONCE) throw new NoiseProtocolError("nonce exhausted");
    const nonce = encodeNonce(this.counter);
    this.counter += 1n;
    return nonce;
  }

  clear(): void {
    this.key?.fill(0);
    this.key = null;
    this.counter = MAX_NONCE;
  }
}

function encodeNonce(counter: bigint): Uint8Array {
  const nonce = new Uint8Array(12);
  let value = counter;
  for (let index = 4; index < 12; index += 1) {
    nonce[index] = Number(value & 0xffn);
    value >>= 8n;
  }
  return nonce;
}
