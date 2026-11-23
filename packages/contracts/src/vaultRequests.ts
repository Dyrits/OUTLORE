import { Schema } from "effect";

// The Vault (connectors specification, The Vault): what its owner reads of it and the requests that put, replace and
// remove a secret. All are the owner's, from the host's window or a paired device, and none is a thread tool. A value
// never crosses them: the secret goes in wrapped (`Redacted`), and every answer carries only a secret's connector,
// kind, date and holder.

/** One secret the Vault holds, as its owner reads it: never a value. */
export const VaultEntry = Schema.Struct({
  /** When the secret was added, as an ISO date. */
  addedAt: Schema.String,
  connectorId: Schema.String,
  /** What keeps the key that seals the records ("Keychain", or the key file's warning); the same for every entry. */
  holder: Schema.String,
  /** The kind of secret, in the owner's words, such as "API key". */
  kind: Schema.String,
});
export type VaultEntry = typeof VaultEntry.Type;

/** The Vault's state in one word; only Ready stores and reads a secret (ADR 0022). */
export const VaultStatus = Schema.Literals(["Absent", "Ready", "Locked", "Lost", "Corrupt"]);
export type VaultStatus = typeof VaultStatus.Type;

/** One harness whose sandbox's hiding of the Vault's folder is not verified, with why. */
export const VaultUnchecked = Schema.Struct({
  /** The harness's name as the owner reads it, such as "Claude Code". */
  harness: Schema.String,
  reason: Schema.String,
});
export type VaultUnchecked = typeof VaultUnchecked.Type;

/** Whether a secret may be stored now, and what stands in the way when it may not. */
export const VaultProtection = Schema.Struct({
  isAllowed: Schema.Boolean,
  /** The refusal when not allowed ("Not protected from Claude Code"), or null. */
  reason: Schema.NullOr(Schema.String),
  unverified: Schema.Array(VaultUnchecked),
});
export type VaultProtection = typeof VaultProtection.Type;

/** The Vault as its owner reads it: its state, what it holds (never a value), and whether a secret may be stored. */
export const VaultView = Schema.Struct({
  entries: Schema.Array(VaultEntry),
  /** What keeps the key, or null when nothing is stored or the state does not name it. */
  holder: Schema.NullOr(
    Schema.Struct({
      isReadableFromSandbox: Schema.Boolean,
      label: Schema.String,
    }),
  ),
  protection: VaultProtection,
  state: VaultStatus,
  /** Why the state is not Ready, in a plain sentence, or null. */
  stateReason: Schema.NullOr(Schema.String),
});
export type VaultView = typeof VaultView.Type;

/** What a check of one harness's sandbox found: whether it hides the Vault's folder, and what the check saw. */
export const VaultDenialCheck = Schema.Struct({
  reason: Schema.String,
  status: Schema.Literals(["Verified", "Unverified", "NotInstalled", "AsksFirst"]),
});
export type VaultDenialCheck = typeof VaultDenialCheck.Type;

/** The Vault's section: its state, its entries and whether a secret may be stored. */
export const ReadVault = Schema.TaggedStruct("ReadVault", {});

/**
 * Stores a new secret for a connector in the Vault. The value crosses only as `Redacted`: it is never echoed in a
 * result, a change announcement or a recorded word, and nothing reads it back but a connector's call.
 */
export const PutSecret = Schema.TaggedStruct("PutSecret", {
  connectorId: Schema.String,
  kind: Schema.String,
  secret: Schema.RedactedFromValue(Schema.String),
});

/** Replaces a stored secret; a connector showing Needs connecting is cleared by it. */
export const ReplaceSecret = Schema.TaggedStruct("ReplaceSecret", {
  connectorId: Schema.String,
  kind: Schema.String,
  secret: Schema.RedactedFromValue(Schema.String),
});

/** Removes one stored secret; removing one already gone is not a failure. */
export const RemoveSecret = Schema.TaggedStruct("RemoveSecret", {
  connectorId: Schema.String,
  kind: Schema.String,
});

/**
 * Runs the live check of Claude Code's sandbox, a turn of the model, and keeps its result as a stamp that gives the
 * Vault's start-up read a stronger reason. Optional: the Vault's rule no longer waits for it, since the start-up read
 * tries Claude Code's denial through the sandbox library it is built on, with no model and no owner step. It spends a
 * fraction of a cent of the owner's own Claude account, so only a request from the owner runs it and no screen offers it.
 */
export const VerifyClaudeVaultDenial = Schema.TaggedStruct("VerifyClaudeVaultDenial", {});

/** The requests that read or change the Vault. */
export const vaultRequests = [ReadVault, PutSecret, ReplaceSecret, RemoveSecret, VerifyClaudeVaultDenial] as const;

/** What each Vault request answers: the Vault after the change, or what the live check found. */
export const vaultResults = {
  PutSecret: VaultView,
  ReadVault: VaultView,
  RemoveSecret: VaultView,
  ReplaceSecret: VaultView,
  VerifyClaudeVaultDenial: VaultDenialCheck,
} as const;
