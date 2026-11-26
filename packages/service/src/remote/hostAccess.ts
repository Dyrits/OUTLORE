import { constantTimeEqual, encodeBase64Url, hashToken, newDeviceToken, newPairingSecret } from "@outlore/channel";
import type { DeviceId, DeviceKind, PairedDevice, RemoteAccessView } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, newId } from "../core/index.ts";
import { webAppOrigin } from "./config.ts";
import {
  ensureHostRecord,
  type HostRecord,
  hostNameOf,
  hostReleaseOf,
  ownAccountLabelOf,
  readHostRecord,
  relayOriginOf,
  renameHost,
  setRelayOrigin,
  setRemoteAccess,
} from "./hostIdentity.ts";
import { bytesOf } from "./knownHosts.ts";

export {
  ensureHostRecord,
  type HostRecord,
  hostNameOf,
  hostReleaseOf,
  ownAccountLabelOf,
  readHostRecord,
  relayOriginOf,
  renameHost,
  setRelayOrigin,
  setRemoteAccess,
};

// Pairing codes and paired devices stored for this host (device-pairing); the connections live in the host runtime.

/** A pairing code lives ten minutes. */
export const pairingCodeMillis = 10 * 60 * 1000;

const hashText = (bytes: Uint8Array) => encodeBase64Url(hashToken(bytes));

/** Makes a pairing code's secret, remembering only its hash, and returns the secret with its expiry. */
export const makePairingSecret = Effect.fnUntraced(function* (now: number) {
  const sql = yield* SqlClient.SqlClient;
  const secret = newPairingSecret();
  const expiresAt = now + pairingCodeMillis;
  const id = yield* newId;
  yield* sql`DELETE FROM pairing_codes WHERE expires_at < ${now} OR used_at IS NOT NULL`;
  yield* sql`INSERT INTO pairing_codes (id, expires_at, secret_hash, used_at)
    VALUES (${id}, ${expiresAt}, ${hashText(secret)}, NULL)`;
  return { expiresAt, secret };
});

/** What a device that paired is given: its identity here and the token it proves itself with. */
type NewDevice = {
  readonly deviceId: string;
  readonly token: Uint8Array;
};

/** Accepts a pairing secret once and enrols the device that presented it; the hash of its token is all kept. */
export const redeemPairingSecret = Effect.fnUntraced(function* (
  secret: Uint8Array,
  device: { kind: DeviceKind; name: string },
  now: number,
) {
  const sql = yield* SqlClient.SqlClient;
  const record = yield* readHostRecord;
  if (record === null || !record.isEnabled) return { refusal: "disabled" } as const;
  const [code] = yield* sql<{ expiresAt: number; id: string; usedAt: number | null }>`
    SELECT id, expires_at AS expiresAt, used_at AS usedAt FROM pairing_codes WHERE secret_hash = ${hashText(secret)}`;
  if (code === undefined) return { refusal: "code-invalid" } as const;
  if (code.usedAt !== null) return { refusal: "code-used" } as const;
  if (code.expiresAt < now) return { refusal: "code-expired" } as const;
  // The update itself decides who used it first when two devices present the same secret together.
  const taken = yield* sql<{ id: string }>`UPDATE pairing_codes SET used_at = ${now}
    WHERE id = ${code.id} AND used_at IS NULL RETURNING id`;
  if (taken.length === 0) return { refusal: "code-used" } as const;
  const deviceId = yield* newId;
  const token = newDeviceToken();
  yield* sql`INSERT INTO paired_devices (id, kind, last_active_at, name, paired_at, token_hash)
    VALUES (${deviceId}, ${device.kind}, ${now}, ${device.name}, ${now}, ${hashText(token)})`;
  return { codeId: code.id, device: { deviceId, token } satisfies NewDevice } as const;
});

/** Takes back a pairing that never delivered its token, deleting the device row and restoring the code while pairing stays enabled. */
export const abandonPairing = Effect.fnUntraced(function* (codeId: string, deviceId: string) {
  const sql = yield* SqlClient.SqlClient;
  const gone = yield* sql<{ id: string }>`DELETE FROM paired_devices WHERE id = ${deviceId} RETURNING id`;
  if (gone.length === 0) return;
  const [host] = yield* sql<{ isEnabled: number }>`SELECT is_enabled AS isEnabled FROM host_identity WHERE id = 1`;
  if (host?.isEnabled === 1) yield* sql`UPDATE pairing_codes SET used_at = NULL WHERE id = ${codeId}`;
});

/** A device that proves itself by its token: its name, or null when it is unknown, disconnected, or wrong. */
export const resumeDevice = Effect.fnUntraced(function* (deviceId: string, token: Uint8Array, now: number) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ name: string; tokenHash: string }>`
    SELECT name, token_hash AS tokenHash FROM paired_devices WHERE id = ${deviceId}`;
  if (row === undefined || !constantTimeEqual(bytesOf(row.tokenHash), hashToken(token))) return null;
  yield* touchDevice(deviceId, now);
  return row.name;
});

/** Whether a device is still paired, as the host registers its connection, so a Disconnect in between is not missed. */
export const isDevicePaired = Effect.fnUntraced(function* (deviceId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`SELECT id FROM paired_devices WHERE id = ${deviceId}`;
  return rows.length > 0;
});

/** Records that a device was active, for Workshop's "last active". */
export const touchDevice = Effect.fnUntraced(function* (deviceId: string, now: number) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE paired_devices SET last_active_at = ${now} WHERE id = ${deviceId}`;
});

/** The paired devices, with which of them are connected now. */
export const listDevices = Effect.fnUntraced(function* (connected: ReadonlySet<string>, direct: ReadonlySet<string>) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    id: string;
    kind: DeviceKind;
    lastActiveAt: number | null;
    name: string;
    pairedAt: number;
  }>`SELECT id, kind, last_active_at AS lastActiveAt, name, paired_at AS pairedAt FROM paired_devices
    ORDER BY paired_at`;
  return rows.map(
    (row): PairedDevice => ({
      ...row,
      id: row.id as DeviceId,
      isConnected: connected.has(row.id),
      isDirect: direct.has(row.id),
    }),
  );
});

/** Forgets a device's pairing; its connection, if any, is closed by the runtime. */
export const forgetDevice = Effect.fnUntraced(function* (deviceId: string) {
  const sql = yield* SqlClient.SqlClient;
  const gone = yield* sql<{ id: string }>`DELETE FROM paired_devices WHERE id = ${deviceId} RETURNING id`;
  if (gone.length === 0) return yield* invalid("That device is not paired with this host.");
});

/** Workshop's remote access section as it stands. */
export const remoteAccessView = Effect.fnUntraced(function* (
  status: RemoteAccessView["status"],
  connected: ReadonlySet<string>,
  direct: ReadonlySet<string>,
) {
  const record = yield* readHostRecord;
  return {
    devices: yield* listDevices(connected, direct),
    hostName: yield* hostNameOf(record),
    isEnabled: record?.isEnabled ?? false,
    isOwnRelay: record?.relayOrigin != null,
    relayOrigin: yield* relayOriginOf(record),
    status,
    webAppUrl: webAppOrigin,
  } satisfies RemoteAccessView;
});
