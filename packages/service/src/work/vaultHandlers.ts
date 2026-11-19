import type {
  PutSecret,
  ReadVault,
  RemoveSecret,
  ReplaceSecret,
  VaultDenialCheck,
  VaultView,
  VerifyClaudeVaultDenial,
} from "@outlore/contracts";
import { Effect } from "effect";
import type { Connectors } from "../connectors/index.ts";
import { Harness, ServiceFailure, type VaultDenial } from "../core/index.ts";
import { harnessLabelOf, type Vault, type VaultFailure, VaultFolder } from "../vault/index.ts";
import { type CommandRunner, changed } from "./commands.ts";

// The Vault's owner requests (connectors blueprint, Owner requests and the app; ADR 0022). All are the owner's, from
// the host's window or a paired device: no thread tool reaches them (the specification's External contract), and the
// secret crosses only as `Redacted`, so it is in no result, no recorded word and no change announcement, which carries
// only a sequence number. A change that stores a secret announces itself, so open screens refetch the Vault's section.

/** The Vault failure's kind in the error kind the app tells apart. */
const errorKinds: Record<VaultFailure["kind"], ServiceFailure["kind"]> = {
  Exists: "InvalidInput",
  Invalid: "InvalidInput",
  Missing: "NotFound",
  NotProtected: "AccessRefused",
  Unavailable: "ExecutionFailure",
  WriteFailed: "ExecutionFailure",
};

/** A Vault failure as the owner reads it: its plain sentence, in the kind of error the app tells apart. */
const failureOf = (failure: VaultFailure): ServiceFailure =>
  new ServiceFailure({ kind: errorKinds[failure.kind], message: failure.message });

/** The Vault as its owner reads it: state, entries (never a value) and whether a secret may be stored now. */
const viewOf = (vault: Vault["Service"]): Effect.Effect<VaultView> =>
  Effect.gen(function* () {
    const state = yield* vault.state;
    // A Corrupt Vault still shows its state; its entries are simply not readable.
    const entries = yield* vault.list.pipe(
      Effect.catchTag("VaultFailure", () => Effect.succeed([] as ReadonlyArray<never>)),
    );
    const protection = yield* vault.protection;
    const holder = "holder" in state ? state.holder : null;
    return {
      entries: entries.map((entry) => ({
        addedAt: entry.addedAt,
        connectorId: entry.connectorId,
        holder: entry.holder,
        kind: entry.kind,
      })),
      holder: holder === null ? null : { isReadableFromSandbox: holder.isReadableFromSandbox, label: holder.label },
      protection: {
        isAllowed: protection.isAllowed,
        reason: protection.reason,
        unverified: protection.unverified.map((unchecked) => ({
          harness: harnessLabelOf(unchecked.harness),
          reason: unchecked.reason,
        })),
      },
      state: state._tag,
      stateReason: "reason" in state ? state.reason : null,
    };
  });

/**
 * Vault request handlers: each change runs in the command runner's transaction and answers the Vault after it; a
 * replaced secret also clears the connector's Needs connecting, as the owner has given it a new key.
 */
export const vaultHandlers = (commands: CommandRunner, vault: Vault["Service"], connectors: Connectors["Service"]) => {
  /** Runs one Vault change, then answers the Vault's view. */
  const changing = (work: Effect.Effect<void, VaultFailure>) =>
    commands.run(work.pipe(Effect.map(() => changed(null)))).pipe(
      Effect.andThen(viewOf(vault)),
      Effect.catchTag("VaultFailure", (failure) => Effect.fail(failureOf(failure))),
    );
  return {
    PutSecret: (given: typeof PutSecret.Type) =>
      changing(vault.put({ connectorId: given.connectorId, kind: given.kind, secret: given.secret })),
    ReadVault: (_given: typeof ReadVault.Type) => viewOf(vault),
    RemoveSecret: (given: typeof RemoveSecret.Type) => changing(vault.remove(given.connectorId, given.kind)),
    ReplaceSecret: (given: typeof ReplaceSecret.Type) =>
      changing(vault.replace({ connectorId: given.connectorId, kind: given.kind, secret: given.secret })).pipe(
        // The connector showing Needs connecting is cleared by the new secret, outside the Vault's own change.
        Effect.tap(() => connectors.clearNeeds(given.connectorId)),
      ),
    VerifyClaudeVaultDenial: (
      _given: typeof VerifyClaudeVaultDenial.Type,
    ): Effect.Effect<VaultDenialCheck, never, Harness | VaultFolder> =>
      Effect.gen(function* () {
        const harness = yield* Harness;
        const folder = yield* VaultFolder;
        const report: VaultDenial = yield* harness.runVaultDenialLive?.("claude", folder) ??
          Effect.succeed({
            harness: "claude",
            reason: "This host's harness has no live probe of the Vault's folder.",
            status: "Unverified",
          } satisfies VaultDenial);
        // A verified probe wrote a fresh stamp, so the Vault's rule reads the adapters' reports again.
        if (report.status === "Verified") yield* vault.refreshDenials;
        return { reason: report.reason, status: report.status };
      }),
  };
};
