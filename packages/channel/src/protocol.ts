import { decodeBase64Url } from "./base64url.ts";
import { fail, type Result, succeed } from "./result.ts";
import { deviceTokenBytes } from "./tokens.ts";

export const maxDeviceNameLength = 60;
const maxNameLength = 200;
const maxReleaseLength = 60;
const pairingSecretLength = 16;

export type DeviceKind = "desktop" | "phone" | "browser";
export type RefusalReason =
  | "code-invalid"
  | "code-expired"
  | "code-used"
  | "unknown-device"
  | "disabled"
  | "disconnected";

/** What the owner reads for each refusal, the same on every kind of device. */
export const refusalText = {
  "code-expired": "That pairing code has expired. Ask the host for a new one.",
  "code-invalid": "That pairing code is not valid. Check that you copied all of it, or ask the host for a new one.",
  "code-used": "That pairing code was already used. Ask the host for a new one.",
  disabled: "The host is not accepting paired devices. Turn on Allow paired devices on the host.",
  disconnected: "The host disconnected this computer. Pair with it again.",
  "unknown-device": "The host no longer knows this computer. Pair with it again.",
} as const satisfies Record<RefusalReason, string>;

/** The first message a paired device sends inside the secure channel. `secret` and `token` are base64url. */
export type ClientHello =
  | { t: "pair"; secret: string; deviceName: string; deviceKind: DeviceKind }
  | { t: "resume"; deviceId: string; token: string };

/**
 * The host's answer to a ClientHello. `token` is base64url of 32 random bytes. `release` is the release the host runs,
 * so a browser can refuse a host of another release; a host that says none is an older one.
 */
export type HostReply =
  | { t: "paired"; deviceId: string; token: string; hostName: string; release?: string }
  | { t: "resumed"; hostName: string; release?: string }
  | { t: "refused"; reason: RefusalReason };

export type ProtocolErrorKind = "malformed";

const refusalReasons = {
  "code-expired": true,
  "code-invalid": true,
  "code-used": true,
  disabled: true,
  disconnected: true,
  "unknown-device": true,
} satisfies Record<RefusalReason, true>;

function isDeviceKind(value: unknown): value is DeviceKind {
  return value === "desktop" || value === "phone" || value === "browser";
}

function isRefusalReason(value: unknown): value is RefusalReason {
  return typeof value === "string" && Object.hasOwn(refusalReasons, value);
}

/** Reads the text of a first message from a device; anything off-shape, including an unknown field, is "malformed". */
export function parseClientHello(text: string): Result<ClientHello, ProtocolErrorKind> {
  const value = parseObject(text);
  if (value === null) return fail("malformed");
  if (value.t === "pair" && hasExactKeys(value, ["deviceKind", "deviceName", "secret", "t"])) {
    const { deviceKind, deviceName, secret } = value;
    if (
      isDeviceKind(deviceKind) &&
      isText(deviceName, maxDeviceNameLength) &&
      isBase64UrlOfLength(secret, pairingSecretLength)
    ) {
      return succeed({ deviceKind, deviceName, secret, t: "pair" });
    }
    return fail("malformed");
  }
  if (value.t === "resume" && hasExactKeys(value, ["deviceId", "t", "token"])) {
    const { deviceId, token } = value;
    if (isText(deviceId, maxNameLength) && isBase64UrlOfLength(token, deviceTokenBytes)) {
      return succeed({ deviceId, t: "resume", token });
    }
  }
  return fail("malformed");
}

/** Reads the text of the host's answer; anything off-shape, including an unknown field, is "malformed". */
export function parseHostReply(text: string): Result<HostReply, ProtocolErrorKind> {
  const value = parseObject(text);
  if (value === null) return fail("malformed");
  if (value.t === "paired" && hasKeys(value, ["deviceId", "hostName", "t", "token"], ["release"])) {
    const { deviceId, hostName, release, token } = value;
    if (
      isText(deviceId, maxNameLength) &&
      isText(hostName, maxNameLength) &&
      isBase64UrlOfLength(token, deviceTokenBytes) &&
      isOptionalRelease(release)
    ) {
      return succeed({ deviceId, hostName, t: "paired", token, ...releaseOf(release) });
    }
  }
  if (value.t === "resumed" && hasKeys(value, ["hostName", "t"], ["release"])) {
    const { hostName, release } = value;
    if (isText(hostName, maxNameLength) && isOptionalRelease(release)) {
      return succeed({ hostName, t: "resumed", ...releaseOf(release) });
    }
  }
  if (value.t === "refused" && hasExactKeys(value, ["reason", "t"])) {
    const { reason } = value;
    if (isRefusalReason(reason)) {
      return succeed({ reason, t: "refused" });
    }
  }
  return fail("malformed");
}

/** The text to send for a hello, as the parser expects it. */
export function encodeClientHello(hello: ClientHello): string {
  return JSON.stringify(hello);
}

/** The text to send for a reply, as the parser expects it. */
export function encodeHostReply(reply: HostReply): string {
  return JSON.stringify(reply);
}

function parseObject(text: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Whether an object has every required key, optionally the optional ones, and no other. */
function hasKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    required.every((key) => keys.includes(key)) && keys.every((key) => required.includes(key) || optional.includes(key))
  );
}

function isOptionalRelease(value: unknown): value is string | undefined {
  return value === undefined || isText(value, maxReleaseLength);
}

const releaseOf = (release: string | undefined) => (release === undefined ? {} : { release });

function hasExactKeys(value: Record<string, unknown>, sortedKeys: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === sortedKeys.length && keys.every((key, index) => key === sortedKeys[index]);
}

/** A string of 1 to `max` characters (code points). */
function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && [...value].length <= max;
}

function isBase64UrlOfLength(value: unknown, byteLength: number): value is string {
  return typeof value === "string" && decodeBase64Url(value)?.byteLength === byteLength;
}
