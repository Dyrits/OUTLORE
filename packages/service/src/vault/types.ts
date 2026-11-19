import { Schema } from "effect";

// What the Vault holds and says about itself (ADR 0022, connectors blueprint `vault/`). Nothing here carries a value.

/** What keeps the Vault's key; chosen once when the Vault is made, then written in its header. */
export const HolderName = Schema.Literals(["keychain", "windows", "secretService", "keyFile"]);
export type HolderName = typeof HolderName.Type;

/** What a holder is, as the Vault's section shows it. */
export type HolderInfo = {
  /** The plain sentence naming it: "Keychain", "Windows account", "Secret service" or the key file's warning. */
  readonly label: string;
  readonly name: HolderName;
  /**
   * Whether a process inside a harness's sandbox can read the key from it. Read from the probes of 2026-11-19: the
   * macOS Keychain answers `security` from inside OpenCode's, Codex's and Claude Code's sandboxes, so it is no layer of
   * its own. A holder not probed counts as readable: the safe answer.
   */
  readonly isReadableFromSandbox: boolean;
};

/** The kind of a secret, in the owner's words: such as "API key". Letters, digits, spaces and dashes. */
export const SecretKind = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,63}$/));
export type SecretKind = typeof SecretKind.Type;

/** A connector's catalog id: letters, digits and underscore, since it forms a permission's identity. */
export const ConnectorId = Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_]{1,64}$/));

/** What the Vault shows of a secret: never its value. */
export type VaultEntry = {
  readonly addedAt: string;
  readonly connectorId: string;
  readonly holder: string;
  readonly kind: string;
};

/** The Vault's state; no state but Ready lets a secret be read or written. */
export type VaultState =
  /** No header: nothing stored; the next `put` makes the Vault. */
  | { readonly _tag: "Absent" }
  | { readonly _tag: "Ready"; readonly holder: HolderInfo }
  /** The holder cannot be reached now, such as a locked Keychain; the Vault stays as it is and tries again. */
  | { readonly _tag: "Locked"; readonly holder: HolderInfo; readonly reason: string }
  /** The holder says the key is gone, or its identifier differs from the records'; the owner enters the secrets again. */
  | { readonly _tag: "Lost"; readonly holder: HolderInfo; readonly reason: string }
  /** The header or a record fails to decode or authenticate; nothing is overwritten and the owner is told. */
  | { readonly _tag: "Corrupt"; readonly reason: string };

/** Why a Vault operation did not happen; each carries one plain sentence for the owner, never a value. */
export class VaultFailure extends Schema.TaggedError<VaultFailure>()("VaultFailure", {
  kind: Schema.Literals(["Unavailable", "NotProtected", "Missing", "Exists", "WriteFailed", "Invalid"]),
  message: Schema.String,
}) {}
