import { Effect, Exit, Schema } from "effect";
import { type FileRead, readVaultFile } from "./files.ts";
import type { KeyCustody } from "./keyCustody.ts";
import {
  Header,
  headerFileName,
  openRecord,
  type RecordsFile,
  RecordsFile as RecordsSchema,
  recordsFileNameOf,
} from "./records.ts";
import type { VaultState } from "./types.ts";

// Reading the Vault's folder into one of its states (ADR 0022). Nothing here writes: a Locked, Lost or Corrupt Vault is
// only ever looked at.

/** What the folder, the key's holder and the records say together. */
export type Inspection =
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Corrupt"; readonly reason: string }
  | {
      readonly _tag: "Locked" | "Lost";
      readonly custody: KeyCustody | null;
      readonly header: Header;
      readonly reason: string;
      readonly records: RecordsFile;
    }
  | {
      readonly _tag: "Ready";
      readonly custody: KeyCustody;
      readonly header: Header;
      readonly key: Buffer;
      readonly records: RecordsFile;
    };

const decodeHeader = Schema.decodeUnknownExit(Schema.fromJsonString(Header));
const decodeRecords = Schema.decodeUnknownExit(Schema.fromJsonString(RecordsSchema));

/** A file's text, `null` when it is not there, or the reason it cannot be used. */
const textOf = (read: FileRead): { readonly text: string | null } | { readonly reason: string } =>
  read._tag === "Bad" ? { reason: read.reason } : { text: read._tag === "Text" ? read.text : null };

/** Looks at the folder, the holder's key and every record, and says what state the Vault is in. */
export const inspect = (folder: string, custodies: ReadonlyArray<KeyCustody>): Effect.Effect<Inspection> =>
  Effect.gen(function* () {
    const headerText = textOf(yield* readVaultFile(folder, headerFileName));
    if ("reason" in headerText) return { _tag: "Corrupt", reason: headerText.reason };
    if (headerText.text === null) return { _tag: "Absent" };
    const header = decodeHeader(headerText.text);
    if (Exit.isFailure(header)) return { _tag: "Corrupt", reason: "The Vault's header does not decode." };
    const recordsText = textOf(yield* readVaultFile(folder, recordsFileNameOf(header.value.keyId)));
    if ("reason" in recordsText) return { _tag: "Corrupt", reason: recordsText.reason };
    // No records file yet is an empty Vault: the header is written first, so a crash between them stores nothing.
    const decoded = recordsText.text === null ? null : decodeRecords(recordsText.text);
    if (decoded !== null && Exit.isFailure(decoded))
      return { _tag: "Corrupt", reason: "The Vault's records do not decode." };
    const records: RecordsFile = decoded === null ? { records: [], version: 1 } : decoded.value;
    const custody = custodies.find((candidate) => candidate.holder.name === header.value.holder) ?? null;
    const known = { custody, header: header.value, records };
    if (custody === null)
      return { ...known, _tag: "Locked", reason: "This computer cannot reach where the Vault's key is kept." };
    const read = yield* custody.read(header.value.keyId);
    if (read._tag === "Unreachable") return { ...known, _tag: "Locked", reason: read.reason };
    if (read._tag === "Gone")
      return { ...known, _tag: "Lost", reason: `${custody.holder.label} no longer holds the Vault's key.` };
    if (records.records.some((record) => record.keyId !== header.value.keyId))
      return { ...known, _tag: "Lost", reason: "The records belong to another key than the header's." };
    if (records.records.some((record) => openRecord(read.key, record) === null))
      return { _tag: "Corrupt", reason: "A record does not authenticate." };
    return { ...known, _tag: "Ready", custody, key: read.key };
  });

/** The state the owner is shown for an inspection. */
export const stateOf = (inspection: Inspection): VaultState => {
  if (inspection._tag === "Absent" || inspection._tag === "Corrupt") return inspection;
  if (inspection._tag === "Ready") return { _tag: "Ready", holder: inspection.custody.holder };
  // A holder this computer lacks is shown by the name the header gave it.
  const holder = inspection.custody?.holder ?? {
    isReadableFromSandbox: true,
    label: inspection.header.holder,
    name: inspection.header.holder,
  };
  return { _tag: inspection._tag, holder, reason: inspection.reason };
};
