import { tmpdir } from "node:os";
import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import type { VaultDenial } from "../core/index.ts";
import { vaultProfileArgsOf, vaultProfileName } from "./codexVaultProfile.ts";
import { type OpenCodeSandbox, wrappedCommandOf } from "./openCodeSandbox.ts";
import { isInstalled, probeVaultDenial, type RunCommand } from "./vaultDenial.ts";

// Each adapter's answer to "does your sandbox hide the Vault's folder" (ADR 0022): the probe of vaultDenial.ts through
// that harness's own wrapper, or the reason none can run.

/** What each probe needs of its adapter's options; `run` lets a check stand in for the real commands. */
type Executable = {
  readonly command: string;
  readonly prefixArgs?: ReadonlyArray<string>;
  readonly run?: RunCommand;
};

const notInstalled = (harness: HarnessName): VaultDenial => ({
  harness,
  reason: "It is not installed on this computer.",
  status: "NotInstalled",
});

/**
 * Claude Code: its sandbox is applied inside a live turn only, and no command of its own runs one without a model, so
 * a probe at start cannot try it and the answer is always Unverified. The live probe is a gated test
 * (test/vault/readDenialLive.test.ts) the owner runs on their machine.
 */
export const readClaudeVaultDenial = (options: Executable, harness: HarnessName) =>
  isInstalled(options.command, options.prefixArgs ?? [], options.run).pipe(
    Effect.map(
      (isPresent): VaultDenial =>
        isPresent
          ? {
              harness,
              reason: "Claude Code's sandbox can be tried only in a live turn, which a probe at start does not run.",
              status: "Unverified",
            }
          : notInstalled(harness),
    ),
  );

/** Codex: `codex sandbox` runs one command under the same profile the adapter gives its threads. */
export const readCodexVaultDenial = (options: Executable, harness: HarnessName, folder: string) =>
  Effect.gen(function* () {
    if (!(yield* isInstalled(options.command, options.prefixArgs ?? [], options.run))) return notInstalled(harness);
    return yield* probeVaultDenial(
      harness,
      folder,
      (path) => ({
        args: [
          ...(options.prefixArgs ?? []),
          "sandbox",
          "-C",
          tmpdir(),
          "-P",
          vaultProfileName,
          ...vaultProfileArgsOf(folder),
          "--",
          "/bin/cat",
          path,
        ],
        command: options.command,
      }),
      options.run,
    );
  });

/** OpenCode: the wrapper the adapter starts it in; with no sandbox here every action asks, so there is nothing to hide. */
export const readOpenCodeVaultDenial = (
  options: Executable & { readonly sandbox: OpenCodeSandbox | null },
  harness: HarnessName,
  folder: string,
) =>
  Effect.gen(function* () {
    const { sandbox } = options;
    if (sandbox === null)
      return {
        harness,
        reason: "It runs no sandbox here, so every action asks.",
        status: "AsksFirst",
      } satisfies VaultDenial;
    if (!(yield* isInstalled(options.command, options.prefixArgs ?? [], options.run))) return notInstalled(harness);
    return yield* probeVaultDenial(
      harness,
      folder,
      (path) => wrappedCommandOf(sandbox, [], "/bin/cat", [path]),
      options.run,
    );
  });
