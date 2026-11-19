import { randomBytes } from "node:crypto";
import { Effect, Redacted } from "effect";
import type { VaultDenial } from "../../src/core/index.ts";
import type { HolderInfo } from "../../src/vault/index.ts";
import { type KeyCustody, type KeyRead, makeVault, type VaultOptions } from "../../src/vault/index.ts";
import { VaultFailure } from "../../src/vault/types.ts";
import { temporary } from "./service.ts";

/** A key holder that keeps keys in memory and can be told to be locked, to lose a key, or to refuse writes. */
export type FakeCustody = KeyCustody & {
  /** The keys it holds, by identifier. */
  readonly keys: Map<string, Buffer>;
  /** Every `write` and `remove` it was asked for, in order, such as `write:abc`. */
  readonly calls: Array<string>;
  /** When set, reading answers Unreachable with this reason. */
  locked: string | null;
  /** When set, writing a key fails. */
  isRefusingWrites: boolean;
  /** When set, a key is accepted but read back as another one. */
  isReadingBackWrong: boolean;
};

/** A fake holder with the given name and sandbox reach. */
export const fakeCustody = (name: HolderInfo["name"] = "keychain", isReadableFromSandbox = true): FakeCustody => {
  const custody: FakeCustody = {
    calls: [],
    holder: { isReadableFromSandbox, label: `Fake ${name}`, name },
    isReadingBackWrong: false,
    isRefusingWrites: false,
    keys: new Map(),
    locked: null,
    read: (keyId): Effect.Effect<KeyRead> =>
      Effect.sync(() => {
        if (custody.locked !== null) return { _tag: "Unreachable", reason: custody.locked } as const;
        const key = custody.keys.get(keyId);
        if (key === undefined) return { _tag: "Gone" } as const;
        return { _tag: "Found", key: custody.isReadingBackWrong ? randomBytes(32) : key } as const;
      }),
    remove: (keyId) =>
      Effect.sync(() => {
        custody.calls.push(`remove:${keyId}`);
        custody.keys.delete(keyId);
      }),
    write: (keyId, key) =>
      Effect.suspend(() => {
        custody.calls.push(`write:${keyId}`);
        if (custody.isRefusingWrites) return Effect.fail(new VaultFailure({ kind: "WriteFailed", message: "refused" }));
        custody.keys.set(keyId, key);
        return Effect.void;
      }),
  };
  return custody;
};

/** A probe report with the same status for every harness named. */
export const denialsOf = (status: VaultDenial["status"], harnesses = ["claude", "codex", "opencode"] as const) =>
  Effect.succeed(harnesses.map((harness): VaultDenial => ({ harness, reason: `${harness} was ${status}.`, status })));

/** A Vault on a temporary folder with the given holders; all harnesses Verified unless a report is given. */
export const vaultOn = (custodies: ReadonlyArray<KeyCustody>, options: Partial<VaultOptions> = {}) => {
  const folder = options.folder ?? temporary("outlore-vault-");
  return { folder, vault: makeVault({ custodies, denials: denialsOf("Verified"), folder, ...options }) };
};

/** A secret request as the Vault takes it. */
export const request = (connectorId: string, secret: string, kind = "API key") => ({
  connectorId,
  kind,
  secret: Redacted.make(secret),
});

/** A distinctive secret that nothing else could contain by chance. */
export const distinctiveSecret = () => `sk-outlore-test-${randomBytes(12).toString("hex")}`;
