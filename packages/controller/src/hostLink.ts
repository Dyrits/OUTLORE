import {
  decodePairingCode,
  encodeBase64Url,
  encodeClientHello,
  type HostReply,
  isLocalOrigin,
  maxDeviceNameLength,
  openInitiator,
  parseHostReply,
  refusalText,
  roomPrologue,
  type SecureChannel,
} from "@outlore/channel";
import type { KnownHost } from "@outlore/contracts";
import { closeCodes, connectClient } from "@outlore/relay/browser";
import type { HostLinkRecord, PairedHostStore } from "./hostStore.ts";
import { type ControllerKind, controllerWords, LinkFailure, linkTexts, releaseProblemOf } from "./linkFailure.ts";

// A controller's link to a host (device-pairing): it pairs with a code, resumes with its token, and holds the end-to-end
// encrypted channel. The desktop app runs it in its service (`service/src/remote/controller.ts`) and the web app in
// the browser (browser access, 0019); only the store of pairings differs. Nothing here needs Node.

/** What the controller running this link is, and what it accepts. */
export interface LinkSettings {
  /** Whether a pairing code may name a relay on this computer: only a test or a development run, or a local page. */
  readonly allowLocalRelay: boolean;
  readonly kind: ControllerKind;
  /** The release this controller runs; the host must run the same one (0019, Versions). */
  readonly release: string;
  /** Cancellation by the owning service fiber closes any channel it opened. */
  readonly signal?: AbortSignal;
}

/** An open link to a host, its answer read; what the host sends next waits until `listen` is called. */
export interface HostLink {
  readonly channel: SecureChannel;
  readonly hostName: string;
  listen(listener: (text: string) => void): void;
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
  let settleFirst: (first: FirstText) => void = () => {};
  const first = new Promise<FirstText>((resolve) => {
    const timer = setTimeout(() => resolve("timedOut"), linkMillis);
    settleFirst = (outcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
  });
  channel.onText((text) => {
    if (!isFirstRead) {
      isFirstRead = true;
      settleFirst({ text });
    } else if (forward === null) later.push(text);
    else forward(text);
  });
  channel.onClose(() => settleFirst("closed"));
  return {
    first,
    listen: (listener: (text: string) => void) => {
      forward = listener;
      for (const text of later.splice(0)) listener(text);
    },
  };
};

type Hello = Parameters<typeof encodeClientHello>[0];

/** Why the relay turned the connection away, from its close code: no host, the host left, or the room is full. */
const relayRefusalOf = (code: number | null) =>
  code === closeCodes.hostOffline || code === closeCodes.hostLeft
    ? linkTexts.hostOffline
    : code === closeCodes.roomFull
      ? linkTexts.roomFull
      : linkTexts.timedOut;

/** Opens the secure channel to a host, saying who this controller is with `hello`, and reads its answer. */
const openToHost = async (
  link: Omit<HostLinkRecord, "deviceId" | "deviceToken" | "hostName">,
  hello: Hello,
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  const connected = await connectClient({ relayOrigin: link.relayOrigin, room: link.room }).catch(() => null);
  if (connected === null || !connected.ok) throw new LinkFailure("couldNotOpen", linkTexts.unreachable);
  const connection = connected.value;
  const abort = () => connection.carrier.close();
  signal?.addEventListener("abort", abort, { once: true });
  connection.carrier.onClose(() => signal?.removeEventListener("abort", abort));
  if (signal?.aborted) {
    abort();
    signal.throwIfAborted();
  }
  const opened = await openInitiator(connection.carrier, link.hostPublicKey, roomPrologue(link.room), {
    handshakeTimeoutMs: linkMillis,
  });
  if (!opened.ok) {
    connection.carrier.close();
    throw new LinkFailure("couldNotOpen", relayRefusalOf(connection.closeCode()));
  }
  const channel = opened.value;
  const tap = tapChannel(channel);
  channel.sendText(encodeClientHello(hello));
  const first = await tap.first;
  const reply = typeof first === "string" ? null : parseHostReply(first.text);
  if (reply === null || !reply.ok) {
    channel.close();
    const isUnread = first === "closed" && hello.t === "pair";
    throw new LinkFailure("couldNotOpen", isUnread ? linkTexts.unreadablePairing : linkTexts.timedOut);
  }
  return { channel, listen: tap.listen, reply: reply.value satisfies HostReply };
};

/** Pairs with the host that made `code`; keeps the host and returns it for the host menu. */
export const pairWithCode = async (
  code: string,
  deviceName: string,
  store: PairedHostStore,
  settings: LinkSettings,
): Promise<KnownHost> => {
  const decoded = decodePairingCode(code);
  if (!decoded.ok) {
    throw new LinkFailure(
      "invalid",
      decoded.kind === "unsupported-version" ? linkTexts.newerCode : refusalText["code-invalid"],
    );
  }
  const pairing = decoded.value;
  // A pasted code must not point this controller at a relay on this computer, unless it runs from here itself.
  if (isLocalOrigin(pairing.relayOrigin) && !settings.allowLocalRelay) {
    throw new LinkFailure("invalid", linkTexts.localRelay);
  }
  const name = deviceName.trim();
  if (name === "" || name.length > maxDeviceNameLength) {
    throw new LinkFailure(
      "invalid",
      `Name this ${controllerWords[settings.kind].self} in 1 to ${maxDeviceNameLength} characters.`,
    );
  }
  const { channel, reply } = await openToHost(
    pairing,
    {
      deviceKind: settings.kind,
      deviceName: name,
      secret: encodeBase64Url(pairing.secret),
      t: "pair",
    },
    settings.signal,
  );
  // The host is told everything it needs; the channel closes once the answer is read.
  channel.close();
  if (reply.t === "refused") throw new LinkFailure("invalid", refusalText[reply.reason]);
  if (reply.t !== "paired") throw new LinkFailure("couldNotOpen", linkTexts.timedOut);
  // The host has already counted this device; the owner can disconnect it there. Nothing is kept for a host this
  // controller cannot use.
  const mismatch = releaseProblemOf(reply.release, settings.release, settings.kind);
  if (mismatch !== null) throw new LinkFailure("otherRelease", mismatch);
  settings.signal?.throwIfAborted();
  return store.save(
    {
      deviceId: reply.deviceId,
      deviceToken: reply.token,
      hostName: reply.hostName,
      hostPublicKey: pairing.hostPublicKey,
      relayOrigin: pairing.relayOrigin,
      room: pairing.room,
    },
    Date.now(),
  );
};

/** Opens a link to a kept host: the secure channel, resumed, or the reason it could not be. */
export const resumeHost = async (store: PairedHostStore, hostId: string, settings: LinkSettings): Promise<HostLink> => {
  const stored = await store.link(hostId);
  if (stored === null) {
    throw new LinkFailure("noSuchHost", `This ${controllerWords[settings.kind].self} has no such host.`);
  }
  const { channel, listen, reply } = await openToHost(
    stored,
    {
      deviceId: stored.deviceId,
      t: "resume",
      token: stored.deviceToken,
    },
    settings.signal,
  );
  if (reply.t !== "resumed") {
    channel.close();
    if (reply.t === "refused") throw new LinkFailure("refused", refusalText[reply.reason]);
    throw new LinkFailure("couldNotOpen", linkTexts.timedOut);
  }
  const mismatch = releaseProblemOf(reply.release, settings.release, settings.kind);
  if (mismatch !== null) {
    channel.close();
    throw new LinkFailure("otherRelease", mismatch);
  }
  // Noting the answer may take a while (the service writes it to its database); `listen` keeps what arrives meanwhile.
  try {
    await store.touch(hostId, reply.hostName, Date.now());
    settings.signal?.throwIfAborted();
  } catch (cause) {
    channel.close();
    throw cause;
  }
  return { channel, hostName: reply.hostName, listen };
};
