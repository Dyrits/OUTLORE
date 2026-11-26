import { tmpdir } from "node:os";
import type { HarnessName } from "@outlore/contracts";
import { Effect, Semaphore } from "effect";
import { errorMessageOf, runShortCommand, type VaultDenial } from "../core/index.ts";
import { sandboxSettingsOf } from "./claudeArgs.ts";
import { nestedSandboxReasonOf, probeVaultDenial, type RunCommand } from "./vaultDenial.ts";

// Claude Code's denial of the Vault's folder, tried at start with no model (ADR 0022, amended 2026-11-23): its sandbox
// is built on Anthropic's open-source `@anthropic-ai/sandbox-runtime` (Apache-2.0), whose `denyRead` is what the
// adapter's `sandboxSettingsOf` asks for. The probe gives that library the filesystem settings the adapter writes and
// asks it to wrap `cat`, as the other harnesses' probes do. It proves the library's denial, which Claude Code's sandbox
// is built on; the owner-run live turn (claudeDenialStamp.ts) remains the stronger proof of Claude Code itself.

/** The library's manager is one per process, started and ended around each probe: only one probe may hold it. */
const manager = Semaphore.makeUnsafe(1);

/** Runs the wrapped command line through the shell, as the library hands it back. */
const runShell: RunCommand = (command, args) => runShortCommand(command, args, {}, 20_000, tmpdir());

/** The library's settings for the folder: the filesystem rules the adapter writes, with no network at all. */
const configOf = (folder: string) => {
  const { filesystem } = sandboxSettingsOf([], folder).sandbox;
  return {
    filesystem: { allowWrite: [...filesystem.allowWrite, "."], denyRead: [folder], denyWrite: [] },
    network: { allowedDomains: [], deniedDomains: [] },
  };
};

const unverified = (harness: HarnessName, reason: string): VaultDenial => ({ harness, reason, status: "Unverified" });

/** A path as one word for the shell, whatever it holds (the Vault's folder has a space on macOS). */
const quoted = (path: string) => `'${path.replaceAll("'", "'\\''")}'`;

/**
 * Probes Claude Code's denial through the sandbox library: starts it with the adapter's settings, wraps the marker's
 * read and a control's, and ends it. A host the library cannot sandbox on (missing bubblewrap on Linux, Windows
 * without its helper), or a service that runs inside a sandbox itself, is Unverified with that reason.
 */
export const probeClaudeSandbox = (harness: HarnessName, folder: string, run?: RunCommand) =>
  Semaphore.withPermits(
    manager,
    1,
  )(
    Effect.gen(function* () {
      // Before the library starts: inside another sandbox its own start fails with an error that blames nobody.
      const nested = yield* nestedSandboxReasonOf(run);
      if (nested !== null) return unverified(harness, nested);
      const library = yield* Effect.tryPromise({
        catch: errorMessageOf,
        try: () => import("@anthropic-ai/sandbox-runtime"),
      }).pipe(Effect.option);
      if (library._tag === "None")
        return unverified(harness, "The sandbox library Claude Code uses could not be loaded.");
      const { SandboxManager } = library.value;
      if (!SandboxManager.isSupportedPlatform())
        return unverified(harness, "Claude Code's sandbox library does not support this platform.");
      const missing = SandboxManager.checkDependencies();
      if (missing.errors.length > 0)
        return unverified(harness, `Claude Code's sandbox cannot run here: ${missing.errors.join(" ")}`);
      return yield* Effect.acquireUseRelease(
        Effect.tryPromise({
          catch: errorMessageOf,
          try: () => SandboxManager.initialize(configOf(folder)),
        }).pipe(Effect.result),
        (started) =>
          started._tag === "Failure"
            ? Effect.succeed(unverified(harness, `Claude Code's sandbox could not be started: ${started.failure}`))
            : probeVaultDenial(
                harness,
                folder,
                (path) =>
                  Effect.tryPromise({
                    catch: () => null,
                    try: () => SandboxManager.wrapWithSandbox(`/bin/cat ${quoted(path)}`),
                  }).pipe(
                    Effect.map((line) => ({ args: ["-c", line], command: "/bin/sh" })),
                    Effect.orElseSucceed(() => null),
                  ),
                run ?? runShell,
              ),
        () => Effect.promise(() => SandboxManager.reset()).pipe(Effect.ignore),
      );
    }),
  );
