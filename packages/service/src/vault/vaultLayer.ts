import { Effect, Layer, Semaphore } from "effect";
import { Harness, type VaultDenial } from "../core/index.ts";
import { CommandRunner, commandRunnerLayer } from "./commandRunner.ts";
import { prepareVaultFolder } from "./files.ts";
import { custodiesOf } from "./keyCustody/index.ts";
import type { KeyCustody } from "./keyCustody.ts";
import { makeVault, Vault, VaultFolder } from "./vault.ts";

// The Vault as the service runs it: the harnesses' probe report asked afresh, the platform's key holders.

/** The harnesses a denial report is asked of. */
const harnessNames = ["claude", "codex", "opencode", "vibe"] as const;

/** Asks each harness's adapter whether its sandbox hides the Vault's folder, all at once. */
const probeAll = (harness: Harness["Service"], folder: string) =>
  Effect.all(
    harnessNames.map(
      (name): Effect.Effect<VaultDenial> =>
        harness.readVaultDenial?.(name, folder) ??
        Effect.succeed({
          harness: name,
          reason: "It runs no enforced sandbox, so every action asks.",
          status: "AsksFirst",
        }),
    ),
    { concurrency: "unbounded" },
  );

/**
 * The Vault in the service: its folder made (mode 0700) at start, the platform's key holders (or those given, in
 * checks), and the harnesses' probe report, asked of each adapter at every protection read and never kept — a report
 * held for the service's life could stay "not installed" or "verified" after a harness is installed, upgraded or
 * removed, and let a secret be stored against a protection that no longer holds.
 */
export const vaultLayer = (folder: string, holders?: ReadonlyArray<KeyCustody>) =>
  Layer.effect(
    Vault,
    Effect.gen(function* () {
      const harness = yield* Harness;
      const runner = yield* CommandRunner;
      yield* Effect.orDie(prepareVaultFolder(folder));
      // One probe at a time: two protection reads at once would otherwise fight over the probe's marker file. The
      // `suspend` asks the adapters afresh at each execution too — a probe built once would freeze each adapter's
      // answer as it was at the layer's start.
      const probing = yield* Semaphore.make(1);
      const denials = Effect.suspend(() => Semaphore.withPermits(probing, 1)(probeAll(harness, folder)));
      // Asked only when a protection check needs it (a first secret, or the Vault's section), not at start: a probe
      // starts each installed harness's own command, which a service start should not do for an owner who never
      // opens the Vault.
      return yield* makeVault({
        custodies: holders ?? custodiesOf(process.platform, folder, runner.run),
        denials,
        folder,
      });
    }),
  ).pipe(Layer.merge(Layer.succeed(VaultFolder, folder)), Layer.provide(commandRunnerLayer));
