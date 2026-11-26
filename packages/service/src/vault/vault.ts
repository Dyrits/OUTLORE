import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { Clock, Context, Effect, Schema, Semaphore } from "effect";
import * as Secret from "effect/Redacted";
import type { VaultDenial } from "../core/index.ts";
import { removeVaultFile, type WriteFile, writeFileWhole } from "./files.ts";
import { inspect, stateOf } from "./inspection.ts";
import type { KeyCustody } from "./keyCustody.ts";
import { type Protection, protectionOf } from "./protection.ts";
import {
  type Header,
  headerFileName,
  openRecord,
  type RecordsFile,
  recordsFileNameOf,
  type SealedRecord,
  sealRecord,
} from "./records.ts";
import { ConnectorId, type HolderName, SecretKind, type VaultEntry, VaultFailure, type VaultState } from "./types.ts";
import { createVault, moveVaultKey, unusable, type VaultKeyContext } from "./vaultKeyOperations.ts";

/** A secret as it enters: `Redacted` from the request until it is sealed. */
export type SecretRequest = {
  readonly connectorId: string;
  readonly kind: string;
  readonly secret: Secret.Redacted<string>;
};

/** The longest secret the Vault takes: a key or a token, never a document. */
const longestSecret = 8192;

const fail = (kind: VaultFailure["kind"], message: string) => new VaultFailure({ kind, message });
const isConnectorId = Schema.is(ConnectorId);
const isSecretKind = Schema.is(SecretKind);

/** The Vault (ADR 0022, connectors blueprint): connector secrets, encrypted, on the host, where `withSecret` is the only read. */
export class Vault extends Context.Service<
  Vault,
  {
    /** The Vault's state, read afresh. */
    readonly state: Effect.Effect<VaultState>;
    /** Whether a secret may be stored now, and which harnesses lack a verified denial. */
    readonly protection: Effect.Effect<Protection>;
    /** Each secret's connector, kind and date, and what holds the key; never a value. */
    readonly list: Effect.Effect<ReadonlyArray<VaultEntry>, VaultFailure>;
    /** Stores a new secret; fails when one of that connector and kind exists, or when the rule refuses it. */
    readonly put: (request: SecretRequest) => Effect.Effect<void, VaultFailure>;
    /** Replaces an existing secret. */
    readonly replace: (request: SecretRequest) => Effect.Effect<void, VaultFailure>;
    /** Removes one secret; one already gone is not a failure. */
    readonly remove: (connectorId: string, kind: string) => Effect.Effect<void, VaultFailure>;
    /** Removes every secret of a connector, idempotent. */
    readonly removeAllOf: (connectorId: string) => Effect.Effect<void, VaultFailure>;
    /** Moves the key to another holder, keeping the old key until the rewrite is durable. */
    readonly moveKey: (to: HolderName) => Effect.Effect<void, VaultFailure>;
    /** Hands a secret to the callback and keeps nothing: the only way to read one. */
    readonly withSecret: <A, E, R>(
      connectorId: string,
      kind: string,
      use: (secret: Secret.Redacted<string>) => Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | VaultFailure, R>;
  }
>()("outlore/Vault") {}

/** The folder the Vault keeps its files in, so the prompt policy can refuse a harness's read of it (work/promptPolicy.ts). */
export class VaultFolder extends Context.Service<VaultFolder, string>()("outlore/VaultFolder") {}

/** What a Vault is made from; a check passes fakes for all of it. */
export type VaultOptions = {
  readonly custodies: ReadonlyArray<KeyCustody>;
  /** The probe report: one denial per harness, read afresh at each protection check. */
  readonly denials: Effect.Effect<ReadonlyArray<VaultDenial>>;
  readonly folder: string;
  /** Replaces the whole-file write, so a check can fail it at one step. */
  readonly writeFile?: WriteFile;
};

/** The Vault over a folder, a set of key holders and a probe report. */
export const makeVault = (options: VaultOptions) =>
  Effect.gen(function* () {
    const { custodies, folder } = options;
    const write = options.writeFile ?? writeFileWhole;
    const writer = yield* Semaphore.make(1);
    const looked = writer.withPermit(inspect(folder, custodies));
    const denials = options.denials;

    const writeRecords = (header: Header, records: RecordsFile) =>
      write(join(folder, recordsFileNameOf(header.keyId)), JSON.stringify(records));
    const writeHeader = (header: Header) => write(join(folder, headerFileName), JSON.stringify(header));
    const protectionFor = (holder: KeyCustody["holder"]) =>
      Effect.map(denials, (report) => protectionOf(holder, report));
    const mustBeProtected = (holder: KeyCustody["holder"]) =>
      Effect.flatMap(protectionFor(holder), (protection) =>
        protection.isAllowed ? Effect.void : Effect.fail(fail("NotProtected", protection.reason ?? "")),
      );
    const keyContext: VaultKeyContext = { custodies, folder, mustBeProtected, writeHeader, writeRecords };

    const checked = (request: SecretRequest) => {
      const value = Secret.value(request.secret);
      return isConnectorId(request.connectorId) &&
        isSecretKind(request.kind) &&
        value !== "" &&
        value.length <= longestSecret
        ? Effect.succeed(value)
        : Effect.fail(fail("Invalid", "A secret needs a connector, a kind and a value of up to 8,192 characters."));
    };

    /** The record as stored: sealed under the key, its date from the clock. */
    const sealed = (request: SecretRequest, value: string, key: Buffer, keyId: string) =>
      Effect.map(Clock.currentTimeMillis, (millis) =>
        sealRecord(
          key,
          keyId,
          {
            addedAt: new Date(millis).toISOString(),
            connectorId: request.connectorId,
            id: randomUUID(),
            kind: request.kind,
          },
          value,
        ),
      );

    const store = (request: SecretRequest, isNew: boolean) =>
      writer.withPermit(
        Effect.gen(function* () {
          const value = yield* checked(request);
          const inspection = yield* inspect(folder, custodies);
          if (inspection._tag === "Absent")
            return isNew
              ? yield* createVault(keyContext, (key, keyId) => sealed(request, value, key, keyId))
              : yield* fail("Missing", "No such secret is stored.");
          if (inspection._tag !== "Ready") return yield* unusable(inspection);
          yield* mustBeProtected(inspection.custody.holder);
          const same = (record: SealedRecord) =>
            record.connectorId === request.connectorId && record.kind === request.kind;
          const exists = inspection.records.records.some(same);
          if (isNew && exists)
            return yield* fail("Exists", "A secret of that kind is already stored; replace it instead.");
          if (!isNew && !exists) return yield* fail("Missing", "No such secret is stored.");
          const record = yield* sealed(request, value, inspection.key, inspection.header.keyId);
          yield* writeRecords(inspection.header, {
            records: [...inspection.records.records.filter((existing) => !same(existing)), record],
            version: 1,
          });
        }),
      );

    /** Removes the records a predicate names; a Lost Vault becomes Absent again once emptied. */
    const removeWhere = (matches: (record: SealedRecord) => boolean) =>
      writer.withPermit(
        Effect.gen(function* () {
          const inspection = yield* inspect(folder, custodies);
          if (inspection._tag === "Absent") return;
          if (inspection._tag !== "Ready" && inspection._tag !== "Lost") return yield* unusable(inspection);
          const left = inspection.records.records.filter((record) => !matches(record));
          if (left.length === inspection.records.records.length) return;
          if (inspection._tag === "Lost" && left.length === 0) {
            yield* removeVaultFile(folder, headerFileName);
            yield* removeVaultFile(folder, recordsFileNameOf(inspection.header.keyId));
            return;
          }
          yield* writeRecords(inspection.header, { records: left, version: 1 });
        }),
      );

    const secretOf = (connectorId: string, kind: string) =>
      writer.withPermit(
        Effect.gen(function* () {
          const inspection = yield* inspect(folder, custodies);
          if (inspection._tag !== "Ready" && inspection._tag !== "Absent") return yield* unusable(inspection);
          const record =
            inspection._tag === "Ready"
              ? inspection.records.records.find((found) => found.connectorId === connectorId && found.kind === kind)
              : undefined;
          const value = record === undefined || inspection._tag !== "Ready" ? null : openRecord(inspection.key, record);
          return value === null ? yield* fail("Missing", "No such secret is stored.") : Secret.make(value);
        }),
      );

    return Vault.of({
      list: Effect.gen(function* () {
        const inspection = yield* looked;
        if (inspection._tag === "Absent") return [];
        if (inspection._tag === "Corrupt") return yield* unusable(inspection);
        const state = stateOf(inspection);
        const holder = "holder" in state ? state.holder.label : "";
        return inspection.records.records.map(({ addedAt, connectorId, kind }) => ({
          addedAt,
          connectorId,
          holder,
          kind,
        }));
      }),
      moveKey: (to) => writer.withPermit(moveVaultKey(keyContext, to)),
      protection: Effect.gen(function* () {
        const state = stateOf(yield* looked);
        const holder = "holder" in state ? state.holder : (custodies[0]?.holder ?? null);
        return holder === null
          ? { isAllowed: false, reason: "This computer has no place to keep a key.", unverified: [] }
          : yield* protectionFor(holder);
      }),
      put: (request) => store(request, true),
      remove: (connectorId, kind) =>
        removeWhere((record) => record.connectorId === connectorId && record.kind === kind),
      removeAllOf: (connectorId) => removeWhere((record) => record.connectorId === connectorId),
      replace: (request) => store(request, false),
      state: Effect.map(looked, stateOf),
      withSecret: (connectorId, kind, use) => Effect.flatMap(secretOf(connectorId, kind), use),
    });
  });
