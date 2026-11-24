import { Deferred, Effect, type Fiber, Schema } from "effect";
import { encodeBase64Url } from "./base64url.ts";
import { type KeyPair, openInitiator, openResponder } from "./channel.ts";
import { encodeDirectControl, parseDirectControl } from "./directControl.ts";
import type { DirectPeer, DirectPeers } from "./directPeer.ts";
import { type DirectTimings, defaultDirectTimings } from "./directSettings.ts";
import type { PathLink } from "./pathLink.ts";
import type { SecureChannel } from "./secureChannel.ts";

// Making a direct channel (device-pairing, Direct path): the device offers through the relay session, the host answers
// through it, the two connect, and a second Noise handshake runs inside the data channel, so that DTLS is not what
// protects the stream. Each try is two messages through the relay however many addresses a machine has.

/** What a direct channel is made with. */
export type DirectSettings = {
  readonly peers: DirectPeers;
  readonly stunServers: readonly string[];
  readonly timings?: Partial<DirectTimings>;
};

/** Why a try did not produce a direct channel; the next try is for later, and the relay serves meanwhile. */
export class DirectFailure extends Schema.TaggedError<DirectFailure>()("DirectFailure", {
  reason: Schema.Literals(["closed", "failed", "refused", "timeout"]),
}) {}

const failed = (reason: DirectFailure["reason"]) => new DirectFailure({ reason });

/**
 * What both Noise handshakes bind in: the room, and this try's identifier, which only the two sides know because it
 * crossed the relay inside their secure channel. A handshake made for another try, or for another room, cannot finish.
 */
export const directPrologue = (room: string, attempt: string): Uint8Array =>
  new TextEncoder().encode(`outlore-direct/1 ${room} ${attempt}`);

const timingsOf = (settings: DirectSettings): DirectTimings => ({ ...defaultDirectTimings, ...settings.timings });

/** Runs a peer's promise as an Effect that fails with `DirectFailure` instead of rejecting. */
const awaiting = <Value>(promise: () => Promise<Value>) =>
  Effect.tryPromise({ catch: () => failed("failed"), try: promise });

/** Gives a step its time, and a timeout as the failure. */
const within = (millis: number) =>
  Effect.timeoutOrElse({ duration: millis, orElse: () => Effect.fail(failed("timeout")) });

/** Closes a peer when its try fails or is interrupted; a try that succeeds hands the peer to its channel. */
const closingOnError = (peer: DirectPeer) => Effect.onError(() => Effect.sync(() => peer.close()));

const waitUntilClosed = (channel: SecureChannel) =>
  Effect.callback<void>((resume) => {
    channel.onClose(() => resume(Effect.void));
  });

/**
 * The device's side. Tries to make a direct channel now, then again after each failure with a doubling wait, and
 * after each drop of a channel it made; it ends only when the fiber running it is interrupted, which the owner of the
 * link does when the link ends. The link must already speak frames.
 */
export const runDeviceUpgrade = Effect.fnUntraced(function* (
  link: PathLink,
  options: { hostPublicKey: Uint8Array; room: string; settings: DirectSettings },
) {
  const timings = timingsOf(options.settings);
  let pending: { answer: Deferred.Deferred<string, DirectFailure>; attempt: string } | null = null;
  link.onControl((text) => {
    const message = parseDirectControl(text);
    if (message === null || pending === null || message.attempt !== pending.attempt) return;
    if (message._tag === "DirectAnswer") Deferred.doneUnsafe(pending.answer, Effect.succeed(message.sdp));
    else if (message._tag === "DirectRefusal") Deferred.doneUnsafe(pending.answer, Effect.fail(failed("refused")));
  });

  const attemptOnce = Effect.gen(function* () {
    const peer = yield* awaiting(() =>
      options.settings.peers.open({ gatherMillis: timings.gatherMillis, stunServers: options.settings.stunServers }),
    );
    return yield* Effect.gen(function* () {
      const offer = yield* awaiting(() => peer.offer()).pipe(within(timings.gatherMillis + timings.answerMillis));
      const attempt = encodeBase64Url(crypto.getRandomValues(new Uint8Array(16)));
      const answer = Deferred.makeUnsafe<string, DirectFailure>();
      pending = { answer, attempt };
      link.sendControl(encodeDirectControl({ _tag: "DirectOffer", attempt, sdp: offer }));
      const sdp = yield* Deferred.await(answer).pipe(within(timings.answerMillis));
      yield* awaiting(() => peer.accept(sdp));
      const carrier = yield* awaiting(() => peer.opened()).pipe(within(timings.openMillis));
      const channel = yield* openInitiator(carrier, options.hostPublicKey, directPrologue(options.room, attempt), {
        handshakeTimeoutMs: timings.handshakeMillis,
      }).pipe(Effect.mapError(() => failed("failed")));
      link.attachDirect(channel);
      channel.onClose(() => peer.close());
      return channel;
    }).pipe(
      closingOnError(peer),
      Effect.ensuring(
        Effect.sync(() => {
          pending = null;
        }),
      ),
    );
  });

  let failures = 0;
  while (true) {
    const outcome = yield* attemptOnce.pipe(Effect.result);
    if (outcome._tag === "Failure") {
      failures += 1;
      const wait = Math.min(timings.firstRetryMillis * 2 ** (failures - 1), timings.longestRetryMillis);
      yield* Effect.sleep(wait);
      continue;
    }
    failures = 0;
    yield* waitUntilClosed(outcome.success);
    yield* Effect.sleep(timings.afterDropMillis);
  }
});

/** How many direct channels a host holds at once, so that its machine is not spent on peers. */
export interface DirectSlots {
  /** A place for one more peer, to give back when it ends; null when all are taken. */
  take(): (() => void) | null;
}

/** A counter of places, `max` at most. */
export const makeDirectSlots = (max: number): DirectSlots => {
  let taken = 0;
  return {
    take: () => {
      if (taken >= max) return null;
      taken += 1;
      let isGiven = false;
      return () => {
        if (isGiven) return;
        isGiven = true;
        taken -= 1;
      };
    },
  };
};

/** What a host needs to answer one device's offers. */
export type HostUpgradeOptions = {
  readonly hostKeyPair: KeyPair;
  /** Whether the host is willing now (the switch "Allow paired devices" is on). */
  readonly isAccepting: () => boolean;
  readonly room: string;
  readonly settings: DirectSettings;
  readonly slots: DirectSlots;
};

/**
 * The host's side for one device's link: answers each offer that arrives through the relay with a peer of its own, and
 * attaches the channel once the device's Noise handshake finishes inside it. A newer offer replaces one still being
 * made. Ends with the link.
 */
export const serveHostUpgrade = Effect.fnUntraced(function* (link: PathLink, options: HostUpgradeOptions) {
  const context = yield* Effect.context<never>();
  const runFork = Effect.runForkWith(context);
  const timings = timingsOf(options.settings);
  let current: Fiber.Fiber<void> | null = null;

  const answerOffer = (message: { attempt: string; sdp: string }) =>
    Effect.gen(function* () {
      const refuse = (reason: "busy" | "off") =>
        Effect.sync(() =>
          link.sendControl(encodeDirectControl({ _tag: "DirectRefusal", attempt: message.attempt, reason })),
        );
      if (!options.isAccepting()) return yield* refuse("off");
      const release = options.slots.take();
      if (release === null) return yield* refuse("busy");
      const peer = yield* awaiting(() =>
        options.settings.peers.open({ gatherMillis: timings.gatherMillis, stunServers: options.settings.stunServers }),
      ).pipe(Effect.onError(() => Effect.sync(release)));
      peer.onClosed(release);
      yield* Effect.gen(function* () {
        const sdp = yield* awaiting(() => peer.answer(message.sdp)).pipe(
          within(timings.gatherMillis + timings.answerMillis),
        );
        link.sendControl(encodeDirectControl({ _tag: "DirectAnswer", attempt: message.attempt, sdp }));
        const carrier = yield* awaiting(() => peer.opened()).pipe(within(timings.openMillis));
        const channel = yield* openResponder(
          carrier,
          options.hostKeyPair,
          directPrologue(options.room, message.attempt),
          {
            handshakeTimeoutMs: timings.handshakeMillis,
          },
        ).pipe(Effect.mapError(() => failed("failed")));
        link.attachDirect(channel);
        channel.onClose(() => peer.close());
      }).pipe(closingOnError(peer));
    }).pipe(Effect.ignore);

  link.onControl((text) => {
    const message = parseDirectControl(text);
    if (message === null || message._tag !== "DirectOffer") return;
    current?.interruptUnsafe();
    current = runFork(answerOffer(message));
  });
  link.onClose(() => {
    current?.interruptUnsafe();
    current = null;
  });
});
