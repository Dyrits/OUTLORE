import type { Effect } from "effect";
import type { HolderInfo, VaultFailure } from "./types.ts";

/** What asking a holder for the key gave. */
export type KeyRead =
  | { readonly _tag: "Found"; readonly key: Buffer }
  /** The holder answered that it has no key under this identifier. */
  | { readonly _tag: "Gone" }
  /** The holder could not be asked: a locked Keychain, a missing tool, no session. Not the same as gone. */
  | { readonly _tag: "Unreachable"; readonly reason: string };

/**
 * Where the Vault's one key is kept (ADR 0022): one interface, an adapter per platform. A key is named by its
 * identifier, so a holder can hold the old key and the new one while a key moves.
 */
export interface KeyCustody {
  /** What it is, for the Vault's section and for the rule that decides whether a secret may be stored. */
  readonly holder: HolderInfo;
  readonly read: (keyId: string) => Effect.Effect<KeyRead>;
  /** Removes a key; one already gone is not a failure. */
  readonly remove: (keyId: string) => Effect.Effect<void, VaultFailure>;
  /** Keeps a key; fails when the holder cannot keep it, so the caller never counts on a key nobody holds. */
  readonly write: (keyId: string, key: Buffer) => Effect.Effect<void, VaultFailure>;
}
