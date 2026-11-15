import {
  decodeBase64Url,
  decodePairingCode,
  encodeBase64Url,
  encodeClientHello,
  type HostReply,
  maxDeviceNameLength,
  openInitiator,
  parseHostReply,
  refusalText,
  roomPrologue,
  type SecureChannel,
} from "@outlore/channel";
import type { KnownHost } from "@outlore/contracts";
import { closeCodes, connectClient } from "@outlore/relay/browser";
import type { PairedHosts, StoredHost } from "./pairedHosts.ts";
import { hostLinkCodes, type OpenTransport } from "./transport.ts";

// A browser as a paired device (browser access, 0019): it pairs with a code, and opens the end-to-end encrypted
// channel to its host itself, with no local service in between. The desktop window does the same through its service
// (`service/src/remote/controller.ts`); the words for each outcome are the same.

/** What the page this runs in tells the link. */
export interface PageSettings {
  /** Whether a pairing code may name a relay on this computer: only a page served from this computer. */
  readonly allowLocalRelay: boolean;
  /** The release of the web app that is running; the host must run the same one. */
  readonly release: string;
}

/** How long pairing or opening a link may take in all. */
const linkMillis = 20_000;

/** An outcome the owner reads, with the close code that tells the client whether trying again can help. */
class LinkFailure extends Error {
  constructor(
    message: string,
    readonly code: number = hostLinkCodes.couldNotOpen,
  ) {
    super(message);
  }
}

const failures = {
  hostOffline: "The host is not connected right now. Check that its Outlore is open and Allow paired devices is on.",
  timedOut: "The host did not answer in time.",
  unreachable: "Could not reach the relay. Check your internet connection.",
} as const;

const isLocalOrigin = (origin: string) => {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
};

/** The words for a host of another release than this web app, or null when they match. */
export const releaseProblemOf = (hostRelease: string | undefined, appRelease: string) =>
  hostRelease === appRelease
    ? null
    : `This web app is release ${appRelease}, but the host runs ${hostRelease ?? "an older release"}. Open the web app of the host's release, or update the host.`;

/**
 * Reads a channel's first text, then keeps whatever comes next until `listen` is called: the host sends its first
 * announcement right behind its answer, and a listener added later must still see it.
 */
const tapChannel = (channel: SecureChannel) => {
  let isFirstRead = false;
  let forward: ((text: string) => void) | null = null;
  const later: string[] = [];
  let settleFirst: (text: string | null) => void = () => {};
  const first = new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), linkMillis);
    settleFirst = (text) => {
      clearTimeout(timer);
      resolve(text);
    };
  });
  channel.onText((text) => {
    if (!isFirstRead) {
      isFirstRead = true;
      settleFirst(text);
    } else if (forward === null) later.push(text);
    else forward(text);
  });
  channel.onClose(() => settleFirst(null));
  return {
    first,
    listen: (listener: (text: string) => void) => {
      forward = listener;
      for (const text of later.splice(0)) listener(text);
    },
  };
};

type Hello = Parameters<typeof encodeClientHello>[0];

/** Opens the secure channel to a host, saying who this browser is with `hello`, and reads its answer. */
const openToHost = async (
  link: Pick<StoredHost, "relayOrigin" | "room"> & { hostPublicKey: Uint8Array },
  hello: Hello,
): Promise<{ channel: SecureChannel; listen: (listener: (text: string) => void) => void; reply: HostReply }> => {
  const connected = await connectClient({ relayOrigin: link.relayOrigin, room: link.room }).catch(() => null);
  if (connected === null || !connected.ok) throw new LinkFailure(failures.unreachable);
  const connection = connected.value;
  const opened = await openInitiator(connection.carrier, link.hostPublicKey, roomPrologue(link.room), {
    handshakeTimeoutMs: linkMillis,
  });
  if (!opened.ok) {
    connection.carrier.close();
    // The relay says why it closed: no host in the room, or the host left it.
    const code = connection.closeCode();
    throw new LinkFailure(
      code === closeCodes.hostOffline || code === closeCodes.hostLeft ? failures.hostOffline : failures.timedOut,
    );
  }
  const channel = opened.value;
  const tap = tapChannel(channel);
  channel.sendText(encodeClientHello(hello));
  const text = await tap.first;
  const reply = text === null ? null : parseHostReply(text);
  if (reply === null || !reply.ok) {
    channel.close();
    throw new LinkFailure(failures.timedOut);
  }
  return { channel, listen: tap.listen, reply: reply.value };
};

/** Pairs this browser with the host that made `code`; keeps the host and returns it for the host menu. */
export const pairFromBrowser = async (
  code: string,
  deviceName: string,
  hosts: PairedHosts,
  page: PageSettings,
): Promise<KnownHost> => {
  const decoded = decodePairingCode(code);
  if (!decoded.ok) {
    throw new Error(
      decoded.kind === "unsupported-version"
        ? "This pairing code is from a newer Outlore. Update this app and try again."
        : refusalText["code-invalid"],
    );
  }
  const pairing = decoded.value;
  // Only a page served from this computer may use a relay on it; a pasted code must not point a site at one.
  if (isLocalOrigin(pairing.relayOrigin) && !page.allowLocalRelay) {
    throw new Error("This pairing code names a relay on this computer, which is not accepted.");
  }
  const name = deviceName.trim();
  if (name === "" || name.length > maxDeviceNameLength) {
    throw new Error(`Name this browser in 1 to ${maxDeviceNameLength} characters.`);
  }
  const { channel, reply } = await openToHost(pairing, {
    deviceKind: "desktop",
    deviceName: name,
    secret: encodeBase64Url(pairing.secret),
    t: "pair",
  });
  // The host is told everything it needs; the channel closes once the answer is read.
  channel.close();
  if (reply.t === "refused") throw new Error(refusalText[reply.reason]);
  if (reply.t !== "paired") throw new Error(failures.timedOut);
  // The host has already counted this device; the owner can disconnect it there. Nothing is kept for a host this web
  // app cannot use.
  const mismatch = releaseProblemOf(reply.release, page.release);
  if (mismatch !== null) throw new Error(mismatch);
  return hosts.save(
    {
      deviceId: reply.deviceId,
      deviceToken: reply.token,
      hostName: reply.hostName,
      hostPublicKey: encodeBase64Url(pairing.hostPublicKey),
      relayOrigin: pairing.relayOrigin,
      room: pairing.room,
    },
    Date.now(),
  );
};

/** Opens a link to a saved host: the secure channel, resumed, or the reason it could not be. */
const resumeHost = async (hosts: PairedHosts, hostId: string, page: PageSettings) => {
  const stored = hosts.link(hostId);
  const hostPublicKey = stored === null ? null : decodeBase64Url(stored.hostPublicKey);
  if (stored === null || hostPublicKey === null) {
    throw new LinkFailure("This browser has no such host.", hostLinkCodes.refused);
  }
  const { channel, listen, reply } = await openToHost(
    { hostPublicKey, relayOrigin: stored.relayOrigin, room: stored.room },
    { deviceId: stored.deviceId, t: "resume", token: stored.deviceToken },
  );
  if (reply.t === "refused") {
    channel.close();
    throw new LinkFailure(refusalText[reply.reason], hostLinkCodes.refused);
  }
  if (reply.t !== "resumed") {
    channel.close();
    throw new LinkFailure(failures.timedOut);
  }
  const mismatch = releaseProblemOf(reply.release, page.release);
  if (mismatch !== null) {
    channel.close();
    throw new LinkFailure(mismatch, hostLinkCodes.otherRelease);
  }
  hosts.touch(hostId, reply.hostName, Date.now());
  return { channel, listen };
};

/**
 * The transport to a paired host for a `ServiceClient`. It reports itself open at once, as the desktop's loopback
 * socket does while the service opens the link, and holds what is sent until the link is up; a link that cannot open
 * closes with the codes the desktop uses: 4000 to try again later, 4002 when trying again cannot help, 4001 when the
 * host ended it.
 */
export const openBrowserTransport =
  (hosts: PairedHosts, hostId: string, page: PageSettings): OpenTransport =>
  (handlers) => {
    const waiting: string[] = [];
    let channel: SecureChannel | null = null;
    let isClosed = false;
    void Promise.resolve().then(async () => {
      if (isClosed) return;
      handlers.onOpen();
      try {
        const opened = await resumeHost(hosts, hostId, page);
        if (isClosed) return opened.channel.close();
        channel = opened.channel;
        opened.listen((text) => handlers.onText(text));
        opened.channel.onClose(() => {
          if (!isClosed) handlers.onClose(hostLinkCodes.ended, "The host disconnected.");
        });
        for (const text of waiting.splice(0)) opened.channel.sendText(text);
      } catch (reason) {
        if (isClosed) return;
        const code = reason instanceof LinkFailure ? reason.code : hostLinkCodes.couldNotOpen;
        const message = reason instanceof Error ? reason.message : failures.unreachable;
        handlers.onClose(code, message.slice(0, 200));
      }
    });
    return {
      close: () => {
        isClosed = true;
        channel?.close();
      },
      get isOpen() {
        return !isClosed;
      },
      send: (text) => {
        if (channel === null) waiting.push(text);
        else channel.sendText(text);
      },
    };
  };
