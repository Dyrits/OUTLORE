import { Effect } from "effect";
import { prepareVaultFolder, removeVaultFile } from "./files.ts";
import { type Inspection, inspect, stateOf } from "./inspection.ts";
import type { KeyCustody } from "./keyCustody.ts";
import {
  type Header,
  newKey,
  openRecord,
  type RecordsFile,
  recordsFileNameOf,
  type SealedRecord,
  sealRecord,
} from "./records.ts";
import { type HolderName, VaultFailure } from "./types.ts";

/** Helpers the Vault passes into key creation and key migration operations. */
export type VaultKeyContext = {
  readonly custodies: ReadonlyArray<KeyCustody>;
  readonly folder: string;
  readonly mustBeProtected: (holder: KeyCustody["holder"]) => Effect.Effect<void, VaultFailure>;
  readonly writeHeader: (header: Header) => Effect.Effect<void, VaultFailure>;
  readonly writeRecords: (header: Header, records: RecordsFile) => Effect.Effect<void, VaultFailure>;
};

const fail = (kind: VaultFailure["kind"], message: string) => new VaultFailure({ kind, message });
const ignoring = (work: Effect.Effect<void, VaultFailure>) => Effect.catch(work, () => Effect.void);

/** The failure for a Vault that is not Ready: its state and why, in a plain sentence. */
export const unusable = (inspection: Inspection) => {
  const state = stateOf(inspection);
  return fail(
    "Unavailable",
    `The Vault is ${state._tag.toLowerCase()}. ${"reason" in state ? state.reason : ""}`.trim(),
  );
};

/** Keeps `key` in `custody` and reads it back; false when the holder would not keep it or answered otherwise. */
export const keepsKey = (custody: KeyCustody, keyId: string, key: Buffer) =>
  custody.write(keyId, key).pipe(
    Effect.flatMap(() => custody.read(keyId)),
    Effect.map((read) => read._tag === "Found" && read.key.equals(key)),
    Effect.catch(() => Effect.succeed(false)),
  );

/** Creates a new Vault on the first custody that keeps a new key, verifying protection before writing files. */
export const createVault = (
  context: VaultKeyContext,
  sealFirstRecord: (key: Buffer, keyId: string) => Effect.Effect<SealedRecord>,
) =>
  Effect.gen(function* () {
    yield* prepareVaultFolder(context.folder);
    const key = newKey();
    let custody: KeyCustody | null = null;
    for (const candidate of context.custodies) {
      if (yield* keepsKey(candidate, key.id, key.key)) {
        custody = candidate;
        break;
      }
      yield* ignoring(candidate.remove(key.id));
    }
    if (custody === null) return yield* fail("WriteFailed", "No place on this computer would keep the Vault's key.");
    const kept = custody;
    yield* context.mustBeProtected(kept.holder).pipe(Effect.tapError(() => ignoring(kept.remove(key.id))));
    const header: Header = { holder: kept.holder.name, keyId: key.id, version: 1 };
    const record = yield* sealFirstRecord(key.key, key.id);
    yield* context.writeHeader(header).pipe(Effect.tapError(() => ignoring(kept.remove(key.id))));
    yield* context.writeRecords(header, { records: [record], version: 1 });
  });

/** Re-encrypts the Vault under a new key in the target holder and commits by renaming the header last. */
export const moveVaultKey = (context: VaultKeyContext, to: HolderName) =>
  Effect.gen(function* () {
    const inspection = yield* inspect(context.folder, context.custodies);
    if (inspection._tag !== "Ready") return yield* unusable(inspection);
    const target = context.custodies.find((candidate) => candidate.holder.name === to);
    if (target === undefined) return yield* fail("Invalid", "This computer has no such place for the key.");
    if (target.holder.name === inspection.header.holder)
      return yield* fail("Invalid", "The key is already kept there.");
    yield* context.mustBeProtected(target.holder);
    const next = newKey();
    const header: Header = { holder: target.holder.name, keyId: next.id, version: 1 };
    const undo = Effect.all([
      ignoring(target.remove(next.id)),
      removeVaultFile(context.folder, recordsFileNameOf(next.id)),
    ]);
    if (!(yield* keepsKey(target, next.id, next.key)))
      return yield* fail("WriteFailed", "The new place would not keep the key; nothing changed.").pipe(
        Effect.tapError(() => undo),
      );
    // The records go to a new file under the new key's name; the header, renamed last, is the one commit point.
    const records: RecordsFile = {
      records: inspection.records.records.map((record) =>
        sealRecord(
          next.key,
          next.id,
          { addedAt: record.addedAt, connectorId: record.connectorId, id: record.id, kind: record.kind },
          openRecord(inspection.key, record) ?? "",
        ),
      ),
      version: 1,
    };
    yield* context.writeRecords(header, records).pipe(
      Effect.flatMap(() => context.writeHeader(header)),
      Effect.tapError(() => undo),
    );
    yield* removeVaultFile(context.folder, recordsFileNameOf(inspection.header.keyId));
    yield* inspection.custody.remove(inspection.header.keyId);
  });
