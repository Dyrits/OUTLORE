import {
  decodeBase64Url,
  encodeBase64Url,
  encodeHostReply,
  type HostReply,
  openResponder,
  parseClientHello,
  type RefusalReason,
  roomPrologue,
  type SecureChannel,
} from "@outlore/channel";
import type { ServerFrame } from "@outlore/contracts";
import type { HostConnection } from "@outlore/relay";
import { Cause, Effect } from "effect";
import type { SqlClient } from "effect/sql";
import type { RemoteConfig } from "./config.ts";
import { encodeServerFrame } from "./frames.ts";
import {
  abandonPairing,
  type HostRecord,
  hostNameOf,
  hostReleaseOf,
  readHostRecord,
  redeemPairingSecret,
  resumeDevice,
  touchDevice,
} from "./hostAccess.ts";
import { type ClientLink, carrierOf } from "./hostCarrier.ts";

/** How long a device has to finish the handshake and say who it is. */
const helloMillis = 15_000;
/** A device's "last active" is written at most this often. */
const touchMillis = 30_000;
/** A refusal is sent, then the channel is closed once the answer has had time to leave. */
const refusalGraceMillis = 200;

/** Storage and service work as the host runtime runs it: with the database and the settings provided. */
export type RunWork = <Value, Error>(
  effect: Effect.Effect<Value, Error, SqlClient.SqlClient | RemoteConfig>,
) => Promise<Value>;

/** What serving paired devices needs from the rest of the service. */
export interface DeviceServerParts {
  /** Registers a screen for committed changes and drafts; the returned function removes it. */
  readonly addSession: (send: (frame: ServerFrame) => void) => () => void;
  /** Registers a connected device so Disconnect can reach it; the returned function removes it. */
  readonly admitDevice: (deviceId: string, close: () => void) => Promise<(() => void) | null>;
  /** Tells the screens that something they show changed, such as a device connecting. */
  readonly announce: () => void;
  /** Answers a request frame from a paired device through the service. */
  readonly answer: (message: string, send: (frame: ServerFrame) => void, deviceId: string) => void;
  readonly isAccepting: () => boolean;
  readonly run: RunWork;
  /** Runs work in one transaction, as redeeming a pairing code must. */
  readonly runInTransaction: RunWork;
}

/** What the supervisor feeds: each client of the room, and what happens when its connection ends. */
export interface DeviceServer {
  /** A frame from a client arrived. */
  readonly deliver: (clientId: string, data: Uint8Array) => void;
  /** Tells every client's carrier that the connection to the relay ended. */
  readonly endAll: () => void;
  /** A client left the room. */
  readonly left: (clientId: string) => void;
  /**
   * A client joined the room: registers its link now and returns what runs its handshake and its hello, which the
   * caller forks; it never fails, and ends when the device is known, refused or gone.
   */
  readonly serve: (connection: HostConnection, record: HostRecord, clientId: string) => Effect.Effect<void>;
}

/**
 * Serves each client of the host's room through its own end-to-end encrypted channel: the handshake, then who the
 * device is (a pairing code or its token), then its requests, answered as the owner's window's are (device-pairing).
 */
export const createDeviceServer = (parts: DeviceServerParts): DeviceServer => {
  const links = new Map<string, ClientLink>();

  /** Says who a device is from its first message; returns what handles its later messages, or null if refused. */
  const authenticate = async (channel: SecureChannel, text: string): Promise<((message: string) => void) | null> => {
    let isClosed = false;
    channel.onClose(() => {
      isClosed = true;
    });
    const reply = (answer: HostReply) => channel.sendText(encodeHostReply(answer));
    const refuse = (reason: RefusalReason) => {
      reply({ reason, t: "refused" });
      setTimeout(() => channel.close(), refusalGraceMillis);
      return null;
    };
    const parsed = parseClientHello(text);
    if (!parsed.ok) {
      channel.close();
      return null;
    }
    const hello = parsed.value;
    // The switch may have gone off after this connection was made: nobody pairs or resumes while it is off.
    if (!parts.isAccepting()) return refuse("disabled");

    const now = Date.now();
    let deviceId: string;
    let redeemedCodeId: string | null = null;
    let newToken: Uint8Array | null = null;
    if (hello.t === "pair") {
      const secret = decodeBase64Url(hello.secret);
      if (secret === null) return refuse("code-invalid");
      const outcome = await parts.runInTransaction(
        redeemPairingSecret(secret, { kind: hello.deviceKind, name: hello.deviceName }, now),
      );
      if ("refusal" in outcome) return refuse(outcome.refusal);
      deviceId = outcome.device.deviceId;
      newToken = outcome.device.token;
      redeemedCodeId = outcome.codeId;
    } else {
      const token = decodeBase64Url(hello.token);
      const name = token === null ? null : await parts.run(resumeDevice(hello.deviceId, token, now));
      if (name === null) return refuse("unknown-device");
      deviceId = hello.deviceId;
    }

    /** A pairing whose token was never delivered is taken back: the device row nobody holds goes, and the code pairs again. */
    const abandon = async () => {
      if (redeemedCodeId === null) return;
      await parts.runInTransaction(abandonPairing(redeemedCodeId, deviceId)).catch(reportFailure);
    };

    // Registered before the answer, then checked: a Disconnect that came in between would otherwise leave this device
    // connected with the authority of an owner it no longer has.
    const removeConnection = await parts.admitDevice(deviceId, () => channel.close());
    if (removeConnection === null) {
      await abandon();
      return refuse(parts.isAccepting() ? "disconnected" : "disabled");
    }
    channel.onClose(removeConnection);
    const leave = async () => {
      removeConnection();
      await abandon();
      channel.close();
      return null;
    };
    const current = await parts.run(readHostRecord);
    if (isClosed || !parts.isAccepting()) return leave();
    const hostName = await parts.run(hostNameOf(current));
    const release = await parts.run(hostReleaseOf);
    // The two reads above yield; a drop in that window is caught here, last, before the answer is sent.
    if (isClosed || !parts.isAccepting()) return leave();
    reply(
      newToken === null
        ? { hostName, release, t: "resumed" }
        : { deviceId, hostName, release, t: "paired", token: encodeBase64Url(newToken) },
    );

    const send = (frame: ServerFrame) => channel.sendText(encodeServerFrame(frame));
    const removeSession = parts.addSession(send);
    channel.onClose(() => {
      removeSession();
      removeConnection();
      parts.announce();
    });
    parts.announce();

    let lastTouch = now;
    return (message) => {
      const at = Date.now();
      if (at - lastTouch > touchMillis) {
        lastTouch = at;
        void parts.run(touchDevice(deviceId, at)).catch(reportFailure);
      }
      parts.answer(message, send, deviceId);
    };
  };

  /** Once the handshake is done: hands each text to the authentication, then to the session it opens. */
  const identify = (channel: SecureChannel) =>
    Effect.callback<void>((resume) => {
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
        authenticate(channel, message)
          .then((session) => {
            handle = session;
            resume(Effect.void);
          })
          .catch((reason) => {
            reportFailure(reason);
            channel.close();
            resume(Effect.void);
          });
      });
      channel.onClose(() => resume(Effect.void));
    });

  const serve = (connection: HostConnection, record: HostRecord, clientId: string) => {
    const link = carrierOf(connection, clientId);
    links.set(clientId, link);
    // The device has until the deadline to finish the handshake and say who it is, or its connection is closed.
    return Effect.gen(function* () {
      const channel = yield* openResponder(
        link.carrier,
        { publicKey: record.publicKey, secretKey: record.secretKey },
        roomPrologue(record.room),
        { handshakeTimeoutMs: helloMillis },
      );
      yield* identify(channel);
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

/** A failure of background storage work has no screen to show it on: it goes to the service's log. */
export const reportFailure = (reason: unknown) => {
  console.error("Outlore device pairing:", reason);
};
