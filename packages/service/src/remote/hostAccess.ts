import {
  constantTimeEqual,
  encodeBase64Url,
  generateKeyPair,
  hashToken,
  newDeviceToken,
  newPairingSecret,
  newRoomName,
} from "@outlore/channel";
import {
  type DeviceId,
  type DeviceKind,
  maxNameLength,
  type PairedDevice,
  type RemoteAccessView,
} from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, newId } from "../core/index.ts";
import { computerNameOf, RemoteConfig, webAppOrigin } from "./config.ts";
import { bytesOf } from "./knownHosts.ts";

// This installation as a host: its identity, its pairing codes and its paired devices (device-pairing). Everything
// here is storage; the connections are in the host runtime.

/** A pairing code lives ten minutes. */
export const pairingCodeMillis = 10 * 60 * 1000;

const hashText = (bytes: Uint8Array) => encodeBase64Url(hashToken(bytes));

/** This installation as a host: its keys, its room on the relay, and its settings. */
export type HostRecord = {
  readonly claimSecret: Uint8Array;
  readonly hostName: string | null;
  readonly isEnabled: boolean;
  readonly publicKey: Uint8Array;
  readonly relayOrigin: string | null;
  readonly room: string;
  readonly secretKey: Uint8Array;
};

type HostRow = {
  claimSecret: string;
  hostName: string | null;
  isEnabled: number;
  publicKey: string;
  relayOrigin: string | null;
  room: string;
  secretKey: string;
};

const hostOf = (row: HostRow): HostRecord => ({
  claimSecret: bytesOf(row.claimSecret),
  hostName: row.hostName,
  isEnabled: row.isEnabled === 1,
  publicKey: bytesOf(row.publicKey),
  relayOrigin: row.relayOrigin,
  room: row.room,
  secretKey: bytesOf(row.secretKey),
});

/** The host record, or null before the owner first turns pairing on or asks for a code. */
export const readHostRecord = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<HostRow>`SELECT claim_secret AS claimSecret, host_name AS hostName, is_enabled AS isEnabled,
    public_key AS publicKey, relay_origin AS relayOrigin, room, secret_key AS secretKey FROM host_identity WHERE id = 1`;
  return row === undefined ? null : hostOf(row);
});

/** The host record, made with fresh keys, a fresh room and a fresh claim secret the first time. */
export const ensureHostRecord = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const existing = yield* readHostRecord;
  if (existing !== null) return existing;
  const keys = generateKeyPair();
  yield* sql`INSERT INTO host_identity (id, claim_secret, host_name, is_enabled, public_key, relay_origin, room, secret_key)
    VALUES (1, ${encodeBase64Url(newDeviceToken())}, NULL, 0, ${encodeBase64Url(keys.publicKey)}, NULL, ${newRoomName()}, ${encodeBase64Url(keys.secretKey)})`;
  const inserted = yield* readHostRecord;
  if (inserted === null) return yield* invalid("The host record could not be made.");
  return inserted;
});

/** The release this host runs. */
export const hostReleaseOf = Effect.gen(function* () {
  const config = yield* RemoteConfig;
  return config.release;
});

/** The name the host shows: the owner's choice, else the computer's. */
export const hostNameOf = Effect.fnUntraced(function* (record: HostRecord | null) {
  const config = yield* RemoteConfig;
  return record?.hostName ?? config.computerName;
});

/**
 * What the computer's own sign-ins and spending are called in the app: the host's name as the owner chose it, else the
 * machine's. It reads the database alone, so any screen can ask for it without the pairing settings.
 */
const ownAccountLabel = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ hostName: string | null }>`SELECT host_name AS hostName FROM host_identity WHERE id = 1`;
  return row?.hostName ?? (yield* Effect.sync(computerNameOf));
});

/** What one harness's own sign-in is called: the owner's name for it, else the host's name ({@link ownAccountLabel}). */
export const ownAccountLabelOf = Effect.fnUntraced(function* (harness: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ label: string }>`SELECT label FROM own_account_labels WHERE harness = ${harness}`;
  return row?.label ?? (yield* ownAccountLabel);
});

/** Names the host; a blank name returns it to the computer's. */
export const renameHost = Effect.fnUntraced(function* (name: string) {
  const sql = yield* SqlClient.SqlClient;
  const trimmed = name.trim();
  if (trimmed.length > maxNameLength) return yield* invalid(`A host's name is at most ${maxNameLength} characters.`);
  yield* ensureHostRecord;
  yield* sql`UPDATE host_identity SET host_name = ${trimmed === "" ? null : trimmed} WHERE id = 1`;
  return yield* hostNameOf(yield* readHostRecord);
});

/** Turns "Allow paired devices" on or off, making the host record the first time it is turned on. */
export const setRemoteAccess = Effect.fnUntraced(function* (isEnabled: boolean) {
  const sql = yield* SqlClient.SqlClient;
  if (isEnabled) yield* ensureHostRecord;
  // A code the owner made before switching off must not come back to life when pairing is switched on again.
  else yield* sql`DELETE FROM pairing_codes WHERE used_at IS NULL`;
  yield* sql`UPDATE host_identity SET is_enabled = ${isEnabled ? 1 : 0} WHERE id = 1`;
});

/** Where a new pairing code points: the host's own relay setting, else the default. */
export const relayOriginOf = Effect.fnUntraced(function* (record: HostRecord | null) {
  const config = yield* RemoteConfig;
  return record?.relayOrigin ?? config.relayOrigin;
});

/** Uses the relay at `origin`, or the shared relay when it is null; the host record is made first if it never was. */
export const setRelayOrigin = Effect.fnUntraced(function* (origin: string | null) {
  const sql = yield* SqlClient.SqlClient;
  yield* ensureHostRecord;
  yield* sql`UPDATE host_identity SET relay_origin = ${origin} WHERE id = 1`;
});

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

/**
 * Takes back a pairing that never delivered its token, as when the connection drops mid-handshake: the device row goes,
 * so the Workshop lists nothing nobody holds, and the code pairs again — but only while pairing is still on, so a code
 * from before an Off does not come back to life (see setRemoteAccess).
 */
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
export const listDevices = Effect.fnUntraced(function* (connected: ReadonlySet<string>) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    id: string;
    kind: DeviceKind;
    lastActiveAt: number | null;
    name: string;
    pairedAt: number;
  }>`SELECT id, kind, last_active_at AS lastActiveAt, name, paired_at AS pairedAt FROM paired_devices
    ORDER BY paired_at`;
  return rows.map((row): PairedDevice => ({ ...row, id: row.id as DeviceId, isConnected: connected.has(row.id) }));
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
) {
  const record = yield* readHostRecord;
  return {
    devices: yield* listDevices(connected),
    hostName: yield* hostNameOf(record),
    isEnabled: record?.isEnabled ?? false,
    isOwnRelay: record?.relayOrigin != null,
    relayOrigin: yield* relayOriginOf(record),
    status,
    webAppUrl: webAppOrigin,
  } satisfies RemoteAccessView;
});
