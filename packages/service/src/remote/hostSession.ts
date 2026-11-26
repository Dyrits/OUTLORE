import {
  makeDirectSlots,
  makePathLink,
  openResponder,
  type PathLink,
  roomPrologue,
  serveHostUpgrade,
} from "@outlore/channel";
import type { HostConnection } from "@outlore/relay";
import { Cause, Effect } from "effect";
import type { HostRecord } from "./hostAccess.ts";
import { authenticateDevice, type DeviceServerParts, type RunWork, reportFailure } from "./hostAuthentication.ts";
import { type ClientLink, carrierOf } from "./hostCarrier.ts";

export { type DeviceServerParts, type RunWork, reportFailure };

/** How long a device has to finish the handshake and say who it is. */
const helloMillis = 15_000;
/** How many direct channels this host holds at once, across all its devices. */
const maxDirectPeers = 16;

/** What the supervisor feeds: each client of the room, and what happens when its connection ends. */
export interface DeviceServer {
  /** A frame from a client arrived. */
  readonly deliver: (clientId: string, data: Uint8Array) => void;
  /** Tells every client's carrier that the connection to the relay ended. */
  readonly endAll: () => void;
  /** A client left the room. */
  readonly left: (clientId: string) => void;
  /** Registers a joining client's link and returns the Effect that runs its handshake and authentication. */
  readonly serve: (connection: HostConnection, record: HostRecord, clientId: string) => Effect.Effect<void>;
}

/** Serves each client of the host's room through its own end-to-end encrypted channel (device-pairing). */
export const createDeviceServer = (parts: DeviceServerParts): DeviceServer => {
  const links = new Map<string, ClientLink>();
  const slots = makeDirectSlots(maxDirectPeers);

  /** Once the handshake is done: hands each text to the authentication, then to the session it opens. */
  const identify = (channel: PathLink) =>
    Effect.callback<boolean>((resume) => {
      let handle: ((message: string) => void) | null = null;
      let isAuthenticating = false;
      channel.onText((message) => {
        if (handle !== null) {
          handle(message);
          return;
        }
        if (isAuthenticating) {
          channel.close();
          return;
        }
        isAuthenticating = true;
        authenticateDevice(parts, channel, message)
          .then((session) => {
            handle = session?.handle ?? null;
            resume(Effect.succeed(session !== null));
          })
          .catch((reason) => {
            reportFailure(reason);
            channel.close();
            resume(Effect.succeed(false));
          });
      });
      channel.onClose(() => resume(Effect.succeed(false)));
    });

  const serve = (connection: HostConnection, record: HostRecord, clientId: string) => {
    const link = carrierOf(connection, clientId);
    links.set(clientId, link);
    // The device has until the deadline to finish the handshake and say who it is, or its connection is closed.
    return Effect.gen(function* () {
      const hostKeyPair = { publicKey: record.publicKey, secretKey: record.secretKey };
      const secure = yield* openResponder(link.carrier, hostKeyPair, roomPrologue(record.room), {
        handshakeTimeoutMs: helloMillis,
      });
      // Messages stay unframed until the device asks for frames, which only a device of this release does.
      const channel = yield* makePathLink(secure);
      const isKnown = yield* identify(channel);
      // Offers for a direct channel are answered only from a device the host has accepted.
      if (isKnown && parts.direct !== null) {
        yield* serveHostUpgrade(channel, {
          hostKeyPair,
          isAccepting: parts.isAccepting,
          room: record.room,
          settings: parts.direct,
          slots,
        });
      }
    }).pipe(
      Effect.timeoutOrElse({ duration: helloMillis, orElse: () => Effect.sync(() => link.carrier.close()) }),
      // A failed handshake already closed the carrier; the device was never a session.
      Effect.catchTag("ChannelFailure", () => Effect.void),
      Effect.catchCause((cause) => Effect.sync(() => reportFailure(Cause.squash(cause)))),
    );
  };

  return {
    deliver: (clientId, data) => links.get(clientId)?.deliver(data),
    endAll: () => {
      for (const link of links.values()) link.end();
      links.clear();
    },
    left: (clientId) => {
      links.get(clientId)?.end();
      links.delete(clientId);
    },
    serve,
  };
};
