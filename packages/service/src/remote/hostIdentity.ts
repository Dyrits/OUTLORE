import { encodeBase64Url, generateKeyPair, newDeviceToken, newRoomName } from "@outlore/channel";
import { maxNameLength } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid } from "../core/index.ts";
import { computerNameOf, RemoteConfig } from "./config.ts";
import { bytesOf } from "./knownHosts.ts";

// This installation's host identity and remote-access settings in SQLite (device-pairing).

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

/** What the computer's own sign-ins and spending are called in the app, reading only the database. */
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
