import {
  type DirectSettings,
  decodeBase64Url,
  encodeBase64Url,
  encodeHostReply,
  type HostReply,
  type PathKind,
  type PathLink,
  parseClientHello,
  type RefusalReason,
} from "@outlore/channel";
import type { ServerFrame } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import type { SqlClient } from "effect/sql";
import type { RemoteConfig } from "./config.ts";
import { encodeServerFrame } from "./frames.ts";
import {
  abandonPairing,
  hostNameOf,
  hostReleaseOf,
  readHostRecord,
  redeemPairingSecret,
  resumeDevice,
  touchDevice,
} from "./hostAccess.ts";

/** A device's "last active" is written at most this often. */
const touchMillis = 30_000;
/** A refusal is sent, then the channel is closed once the answer has had time to leave. */
const refusalGraceMillis = 200;

/** Storage and service work as the host runtime runs it: with the database and the settings provided. */
export type RunWork = <Value, Failure>(
  effect: Effect.Effect<Value, Failure, SqlClient.SqlClient | RemoteConfig>,
) => Promise<Value>;

/** A device the host accepted, as the rest of the host sees it. */
export type DeviceSession = { readonly handle: (message: string) => void };

/** What serving paired devices needs from the rest of the service. */
export type DeviceServerParts = {
  /** Registers a screen for committed changes and drafts; the returned function removes it. */
  readonly addSession: (send: (frame: ServerFrame) => void) => () => void;
  /** Registers a connected device so Disconnect can reach it; the returned function removes it. */
  readonly admitDevice: (deviceId: string, close: () => void) => Promise<(() => void) | null>;
  /** Tells the screens that something they show changed, such as a device connecting. */
  readonly announce: () => void;
  /** Answers a request frame from a paired device through the service. */
  readonly answer: (message: string, send: (frame: ServerFrame) => void, deviceId: string) => void;
  /** How this host makes direct channels; null where it makes none (device-pairing, Direct path). */
  readonly direct: DirectSettings | null;
  readonly isAccepting: () => boolean;
  /** A device's messages moved to the relay or to a direct channel. */
  readonly onPath: (deviceId: string, path: PathKind) => void;
  readonly run: RunWork;
  /** Runs work in one transaction, as redeeming a pairing code must. */
  readonly runInTransaction: RunWork;
};

/** A failure of background storage work has no screen to show it on: it goes to the service's log, which the process top sets up. */
export const reportFailure = (reason: unknown) => {
  Effect.runFork(Effect.logError("Outlore device pairing", reason));
};

/** Authenticates a device from its first message and wires its session handlers, or returns null when refused. */
export const authenticateDevice = async (
  parts: DeviceServerParts,
  channel: PathLink,
  text: string,
): Promise<DeviceSession | null> => {
  let isClosed = false;
  channel.onClose(() => {
    isClosed = true;
  });
  const reply = (answer: HostReply) => channel.sendText(encodeHostReply(answer));
  const refuse = (reason: RefusalReason, release?: string) => {
    reply(release === undefined ? { reason, t: "refused" } : { reason, release, t: "refused" });
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

  const now = await parts.run(Clock.currentTimeMillis);
  let deviceId: string;
  let redeemedCodeId: string | null = null;
  let newToken: Uint8Array | null = null;
  if (hello.t === "pair") {
    // A device of another release cannot use this host and refuses it after the fact, so it is turned away first: the code is not spent and no device is kept.
    const hostRelease = await parts.run(hostReleaseOf);
    if (hello.release !== hostRelease) return refuse("other-release", hostRelease);
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

  // Registered before the answer, then checked: a Disconnect that came in between would otherwise leave this device connected with the authority of an owner it no longer has.
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

  channel.onPath((path) => {
    parts.onPath(deviceId, path);
    parts.announce();
  });

  let lastTouch = now;
  return {
    handle: (message) => {
      void parts
        .run(
          Clock.currentTimeMillis.pipe(
            Effect.flatMap((at) => {
              if (at - lastTouch <= touchMillis) return Effect.void;
              lastTouch = at;
              return touchDevice(deviceId, at);
            }),
          ),
        )
        .catch(reportFailure);
      parts.answer(message, send, deviceId);
    },
  };
};
