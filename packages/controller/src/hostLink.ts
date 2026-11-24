import {
  type DirectSettings,
  encodeBase64Url,
  encodeClientHello,
  type HostReply,
  isLocalOrigin,
  makePathLink,
  maxDeviceNameLength,
  openInitiator,
  type PathLink,
  parseHostReply,
  readPairingInput,
  refusalText,
  roomPrologue,
  runDeviceUpgrade,
  type SecureChannel,
} from "@outlore/channel";
import { closeCodes, connectClient } from "@outlore/relay/browser";
import { Clock, Deferred, Effect, type Fiber } from "effect";
import type { HostLinkRecord, PairedHostStore } from "./hostStore.ts";
import { type ControllerKind, controllerWords, LinkFailure, linkTexts, releaseProblemOf } from "./linkFailure.ts";

// A controller's link to a host (device-pairing): it pairs with a code, resumes with its token, and holds the end-to-end
// encrypted channel. The desktop app runs it in its service (`service/src/remote/controller.ts`) and the web app in
// the browser (browser access, 0019); only the store of pairings differs. Nothing here needs Node.

/** What the controller running this link is, and what it accepts. */
export interface LinkSettings {
  /** Whether a pairing code may name a relay on this computer: only a test or a development run, or a local page. */
  readonly allowLocalRelay: boolean;
  /**
   * How this controller makes direct channels to a host that runs its release (device-pairing, Direct path); without
   * it, or where the platform has no WebRTC, a link stays on the relay.
   */
  readonly direct?: DirectSettings;
  readonly kind: ControllerKind;
  /** The release this controller runs; the host must run the same one (0019, Versions). */
  readonly release: string;
}

/** An open link to a host, its answer read; what the host sends next waits until `listen` is called. */
export interface HostLink {
  /** The secure channel to the host: over the relay, and over a direct channel when one is up. */
  readonly channel: PathLink;
  readonly hostName: string;
  listen(listener: (text: string) => void): void;
  /** The release the host runs, as it said when the link resumed. */
  readonly release: string;
}

/** How long pairing or opening a link may take in all. */
const linkMillis = 20_000;

/** Whether a relay address is on this computer: only a test, a development run or a page served locally names one. */
export { isLocalOrigin } from "@outlore/channel";

type FirstText = { readonly text: string } | "closed" | "timedOut";

/**
 * Reads a channel's first text, then keeps whatever comes next until `listen` is called: the host sends its first
 * announcement right behind its answer, and a listener added later must still see it.
 */
const tapChannel = (channel: SecureChannel) => {
  let isFirstRead = false;
  let forward: ((text: string) => void) | null = null;
  const later: string[] = [];
  const first = Deferred.makeUnsafe<FirstText>();
  const settleFirst = (outcome: FirstText) => Deferred.doneUnsafe(first, Effect.succeed(outcome));
  channel.onText((text) => {
    if (!isFirstRead) {
      isFirstRead = true;
      settleFirst({ text });
    } else if (forward === null) later.push(text);
    else forward(text);
  });
  channel.onClose(() => settleFirst("closed"));
  return {
    first: Deferred.await(first).pipe(
      Effect.timeoutOrElse({ duration: linkMillis, orElse: () => Effect.succeed("timedOut" as const) }),
    ),
    listen: (listener: (text: string) => void) => {
      forward = listener;
      for (const text of later.splice(0)) listener(text);
    },
  };
};

type Hello = Parameters<typeof encodeClientHello>[0];

/**
 * Why the relay turned the connection away, from its close code: no host, the host left, the room is full, or the
 * relay limited this connection (trying again later may help).
 */
const relayRefusalOf = (code: number | null) =>
  code === closeCodes.hostOffline || code === closeCodes.hostLeft
    ? linkTexts.hostOffline
    : code === closeCodes.roomFull
      ? linkTexts.roomFull
      : code === closeCodes.rateLimited
        ? linkTexts.busy
        : linkTexts.timedOut;

/**
 * Opens the secure channel to a host, saying who this controller is with `hello`, and reads its answer. The relay
 * connection and the channel close when the fiber is interrupted or anything below fails; once the answer is read, the
 * caller owns the channel.
 */
const openToHost = Effect.fnUntraced(function* (
  link: Omit<HostLinkRecord, "deviceId" | "deviceToken" | "hostName">,
  hello: Hello,
) {
  const connection = yield* connectClient({ relayOrigin: link.relayOrigin, room: link.room }).pipe(
    Effect.mapError(() => new LinkFailure("couldNotOpen", linkTexts.unreachable)),
  );
  const secure = yield* openInitiator(connection.carrier, link.hostPublicKey, roomPrologue(link.room), {
    handshakeTimeoutMs: linkMillis,
  }).pipe(
    Effect.mapError(() => new LinkFailure("couldNotOpen", relayRefusalOf(connection.closeCode()))),
    Effect.onError(() => Effect.sync(() => connection.carrier.close())),
  );
  // The link carries the hello and the answer unframed, as every host reads them; frames start only once both agree.
  const channel = yield* makePathLink(secure);
  return yield* Effect.gen(function* () {
    const tap = tapChannel(channel);
    channel.sendText(encodeClientHello(hello));
    const first = yield* tap.first;
    const reply = typeof first === "string" ? null : parseHostReply(first.text);
    if (reply === null || !reply.ok) {
      const isUnread = first === "closed" && hello.t === "pair";
      return yield* new LinkFailure("couldNotOpen", isUnread ? linkTexts.unreadablePairing : linkTexts.timedOut);
    }
    return { channel, listen: tap.listen, reply: reply.value satisfies HostReply };
  }).pipe(Effect.onError(() => Effect.sync(() => channel.close())));
});

const linkFailureOf = (reason: unknown): LinkFailure =>
  reason instanceof LinkFailure
    ? reason
    : new LinkFailure("couldNotOpen", reason instanceof Error ? reason.message : linkTexts.unreachable);

/** Pairs with the host that made `code`, a raw pairing code or a pairing link; keeps the host and returns it for the host menu. */
export const pairWithCode = Effect.fnUntraced(function* (
  code: string,
  deviceName: string,
  store: PairedHostStore,
  settings: LinkSettings,
) {
  const decoded = readPairingInput(code);
  if (!decoded.ok) {
    return yield* new LinkFailure(
      "invalid",
      decoded.kind === "unsupported-version" ? linkTexts.newerCode : refusalText["code-invalid"],
    );
  }
  const pairing = decoded.value;
  // A pasted code must not point this controller at a relay on this computer, unless it runs from here itself.
  if (isLocalOrigin(pairing.relayOrigin) && !settings.allowLocalRelay) {
    return yield* new LinkFailure("invalid", linkTexts.localRelay);
  }
  const name = deviceName.trim();
  if (name === "" || name.length > maxDeviceNameLength) {
    return yield* new LinkFailure(
      "invalid",
      `Name this ${controllerWords[settings.kind].self} in 1 to ${maxDeviceNameLength} characters.`,
    );
  }
  const { channel, reply } = yield* openToHost(pairing, {
    deviceKind: settings.kind,
    deviceName: name,
    release: settings.release,
    secret: encodeBase64Url(pairing.secret),
    t: "pair",
  });
  // The host is told everything it needs; the channel closes once the answer is read.
  channel.close();
  if (reply.t === "refused" && reply.reason === "other-release") {
    // The host turned the pairing away before keeping the device or spending the code.
    const mismatch = releaseProblemOf(reply.release, settings.release, settings.kind);
    return yield* new LinkFailure("otherRelease", mismatch ?? refusalText["other-release"]);
  }
  if (reply.t === "refused") return yield* new LinkFailure("invalid", refusalText[reply.reason]);
  if (reply.t !== "paired") return yield* new LinkFailure("couldNotOpen", linkTexts.timedOut);
  // A host of another release turns a pairing away before it keeps anything; one that answered anyway (an earlier
  // release) has counted this device, and the owner can disconnect it there. Nothing is kept for a host this
  // controller cannot use.
  const mismatch = releaseProblemOf(reply.release, settings.release, settings.kind);
  if (mismatch !== null) return yield* new LinkFailure("otherRelease", mismatch);
  const now = yield* Clock.currentTimeMillis;
  return yield* Effect.tryPromise({
    catch: linkFailureOf,
    try: () =>
      store.save(
        {
          deviceId: reply.deviceId,
          deviceToken: reply.token,
          hostName: reply.hostName,
          hostPublicKey: pairing.hostPublicKey,
          relayOrigin: pairing.relayOrigin,
          room: pairing.room,
        },
        now,
      ),
  });
});

/** Starts the device's tries for a direct channel, which end with the link. */
const startUpgrade = (
  channel: PathLink,
  stored: Pick<HostLinkRecord, "hostPublicKey" | "room">,
  direct: DirectSettings,
) =>
  Effect.gen(function* () {
    channel.enableFrames();
    const tries: Fiber.Fiber<void> = yield* Effect.forkDetach(
      runDeviceUpgrade(channel, { hostPublicKey: stored.hostPublicKey, room: stored.room, settings: direct }),
    );
    channel.onClose(() => tries.interruptUnsafe());
  });

/** What else a resumed link may be asked to be. */
export interface ResumeOptions {
  /**
   * Keep the link when the host runs another release than this controller. Only the link that updates the host uses
   * it (app-updates, Updating a host from a paired device): it sends the two requests about updating and nothing else.
   */
  readonly acceptOtherRelease?: boolean;
}

/** Opens a link to a kept host: the secure channel, resumed, or the reason it could not be. */
export const resumeHost = Effect.fnUntraced(function* (
  store: PairedHostStore,
  hostId: string,
  settings: LinkSettings,
  options: ResumeOptions = {},
) {
  const stored = yield* Effect.tryPromise({ catch: linkFailureOf, try: () => store.link(hostId) });
  if (stored === null) {
    return yield* new LinkFailure("noSuchHost", `This ${controllerWords[settings.kind].self} has no such host.`);
  }
  const { channel, listen, reply } = yield* openToHost(stored, {
    deviceId: stored.deviceId,
    t: "resume",
    token: stored.deviceToken,
  });
  // From here the channel closes unless the link is handed over: on a refusal, another release, a failed store, or
  // an interruption (the owning fiber was canceled).
  return yield* Effect.gen(function* () {
    if (reply.t !== "resumed") {
      if (reply.t === "refused") return yield* new LinkFailure("refused", refusalText[reply.reason]);
      return yield* new LinkFailure("couldNotOpen", linkTexts.timedOut);
    }
    const mismatch = releaseProblemOf(reply.release, settings.release, settings.kind);
    if (mismatch !== null && options.acceptOtherRelease !== true) {
      return yield* new LinkFailure("otherRelease", mismatch);
    }
    // Only a host of this very release is known to speak frames and to make direct channels.
    if (mismatch === null && settings.direct !== undefined) yield* startUpgrade(channel, stored, settings.direct);
    // Noting the answer may take a while (the service writes it to its database); `listen` keeps what arrives meanwhile.
    const now = yield* Clock.currentTimeMillis;
    yield* Effect.tryPromise({ catch: linkFailureOf, try: () => store.touch(hostId, reply.hostName, now) });
    return { channel, hostName: reply.hostName, listen, release: reply.release ?? "" } satisfies HostLink;
  }).pipe(Effect.onError(() => Effect.sync(() => channel.close())));
});
