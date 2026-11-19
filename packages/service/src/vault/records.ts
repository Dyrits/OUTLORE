import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Schema } from "effect";
import { HolderName } from "./types.ts";

// The Vault's two files and the sealing of a record (ADR 0022). A record is sealed with AES-256-GCM, a fresh nonce
// each, and the record's identifier and connector bound in as additional authenticated data, so a record moved to
// another connector, or given another identifier, does not open.

/** The format both files carry; a version this build does not know is Corrupt, never guessed at. */
export const formatVersion = 1;

/** The header: the holder chosen once when the Vault was made, and the identifier of its key. */
export const Header = Schema.Struct({
  holder: HolderName,
  keyId: Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/)),
  version: Schema.Literal(formatVersion),
});
export type Header = typeof Header.Type;

/** One sealed secret: what shows of it, and its ciphertext. */
export const SealedRecord = Schema.Struct({
  addedAt: Schema.String,
  ciphertext: Schema.String,
  connectorId: Schema.String,
  id: Schema.String,
  keyId: Schema.String,
  kind: Schema.String,
  nonce: Schema.String,
  tag: Schema.String,
});
export type SealedRecord = typeof SealedRecord.Type;

/** The records file: every record, all sealed under the key the header names. */
export const RecordsFile = Schema.Struct({
  records: Schema.Array(SealedRecord),
  version: Schema.Literal(formatVersion),
});
export type RecordsFile = typeof RecordsFile.Type;

/** The name of the header file in the Vault's folder. */
export const headerFileName = "header.json";

/** The name of the records file for a key: a move to another key writes a new file and then the header names it. */
export const recordsFileNameOf = (keyId: string) => `records-${keyId}.json`;

/** A new random 256-bit key, and its identifier. */
export const newKey = () => ({ id: randomBytes(16).toString("hex"), key: randomBytes(32) });

/** What binds a record to its place: no other identifier or connector can open it. */
const aadOf = (id: string, connectorId: string) => Buffer.from(JSON.stringify([id, connectorId]), "utf8");

/** Seals a secret under a key into a record. */
export const sealRecord = (
  key: Buffer,
  keyId: string,
  fields: { readonly addedAt: string; readonly connectorId: string; readonly id: string; readonly kind: string },
  secret: string,
): SealedRecord => {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aadOf(fields.id, fields.connectorId));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return {
    ...fields,
    ciphertext: ciphertext.toString("base64"),
    keyId,
    nonce: nonce.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
};

/** Opens a record with a key; null when it does not authenticate (the wrong key, a changed record, a moved one). */
export const openRecord = (key: Buffer, record: SealedRecord): string | null => {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(record.nonce, "base64"));
    decipher.setAAD(aadOf(record.id, record.connectorId));
    decipher.setAuthTag(Buffer.from(record.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, "base64")), decipher.final()]).toString(
      "utf8",
    );
  } catch {
    return null;
  }
};
