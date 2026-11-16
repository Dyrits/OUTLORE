import { Effect, Schema } from "effect";
import type { Carrier } from "./carrier.ts";
import {
  createNoiseInitiator,
  createNoiseResponder,
  generateNoiseKeyPair,
  type NoiseHandshake,
  type NoiseKeyPair,
} from "./noise/index.ts";
import { type SecureChannel, Session } from "./secureChannel.ts";

/** An X25519 key pair, 32 bytes each: the host's long-term identity. */
export type KeyPair = NoiseKeyPair;

export type ChannelErrorKind = "handshake-failed" | "handshake-timeout" | "carrier-closed";

export class ChannelFailure extends Schema.TaggedError<ChannelFailure>()("ChannelFailure", {
  kind: Schema.Literals(["handshake-failed", "handshake-timeout", "carrier-closed"]),
}) {}

export type ChannelOptions = {
  /** How long the handshake may take before it gives up; defaults to 15 seconds. */
  handshakeTimeoutMs?: number;
};

export const defaultHandshakeTimeoutMs = 15_000;
const emptyPayload = new Uint8Array(0);

/** Makes a fresh X25519 key pair; a host makes one once and keeps it. */
export function generateKeyPair(): KeyPair {
  return generateNoiseKeyPair();
}

/**
 * The paired device's side: opens an end-to-end encrypted channel to the host whose public key it knows from the
 * pairing code. The prologue is arbitrary bytes both sides must agree on, such as the room name.
 */
export const openInitiator = Effect.fnUntraced(function* (
  carrier: Carrier,
  hostPublicKey: Uint8Array,
  prologue: Uint8Array,
  options: ChannelOptions = {},
) {
  const handshake = yield* Effect.try({
    catch: () => new ChannelFailure({ kind: "handshake-failed" }),
    try: () => createNoiseInitiator({ prologue, remoteStatic: hostPublicKey }),
  });
  return yield* handshakeResult(carrier, handshake, true, options);
});

/** The host's side: owns the static key, waits for a device's first message, and answers it. */
export const openResponder = Effect.fnUntraced(function* (
  carrier: Carrier,
  hostKeyPair: KeyPair,
  prologue: Uint8Array,
  options: ChannelOptions = {},
) {
  const handshake = yield* Effect.try({
    catch: () => new ChannelFailure({ kind: "handshake-failed" }),
    try: () => createNoiseResponder({ localStatic: hostKeyPair, prologue }),
  });
  return yield* handshakeResult(carrier, handshake, false, options);
});

/**
 * Drives the two NK handshake messages over the carrier and then keeps feeding the same carrier to the session, so a
 * record that arrives right behind the last handshake message is not lost. A handshake that is still unfinished when
 * its time is up, or when the fiber running it is interrupted, closes the carrier.
 */
const handshakeResult = (carrier: Carrier, handshake: NoiseHandshake, isInitiator: boolean, options: ChannelOptions) =>
  Effect.callback<SecureChannel, ChannelFailure>((resume) => {
    let session: Session | null = null;
    let isSettled = false;
    const settle = (effect: Effect.Effect<SecureChannel, ChannelFailure>) => {
      if (isSettled) return;
      isSettled = true;
      resume(effect);
    };
    const fail = (kind: ChannelErrorKind) => settle(Effect.fail(new ChannelFailure({ kind })));

    carrier.onClose(() => {
      if (session === null) fail("carrier-closed");
      else session.carrierClosed();
    });
    carrier.onMessage((data) => {
      if (session !== null) {
        session.receive(data);
        return;
      }
      // After a failure the carrier is closing; whatever still arrives is ignored.
      if (isSettled) return;
      try {
        handshake.readMessage(data);
        if (!isInitiator) carrier.send(handshake.writeMessage(emptyPayload));
        session = new Session(carrier, handshake.split());
      } catch {
        fail("handshake-failed");
        carrier.close();
        return;
      }
      settle(Effect.succeed(session));
    });

    if (isInitiator) {
      try {
        carrier.send(handshake.writeMessage(emptyPayload));
      } catch {
        fail("carrier-closed");
        carrier.close();
      }
    }
    return Effect.sync(() => {
      isSettled = true;
      if (session === null) carrier.close();
    });
  }).pipe(
    Effect.timeoutOrElse({
      duration: options.handshakeTimeoutMs ?? defaultHandshakeTimeoutMs,
      orElse: () => Effect.fail(new ChannelFailure({ kind: "handshake-timeout" })),
    }),
  );
