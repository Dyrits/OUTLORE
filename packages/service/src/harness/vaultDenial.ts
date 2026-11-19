import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import { type CommandRun, runShortCommand, type VaultDenial } from "../core/index.ts";

// The probe behind "Protected, or no secrets" (ADR 0022, connectors blueprint): for one harness, whether a process
// inside its sandbox can read a marker file in the Vault's folder. The marker is a disposable random string, never a
// secret. The probe fails closed: anything but a clean denial, beside a control that proves the sandbox ran and an
// outside read that proves the marker was there, is Unverified.

/** Runs a command and reports how it ended; the default runs the real one, a check passes a fake. */
export type RunCommand = (command: string, args: ReadonlyArray<string>) => Effect.Effect<CommandRun>;

/** The real command runner, with a short limit: a sandbox that starts answers at once. */
const runReal: RunCommand = (command, args) => runShortCommand(command, args, {}, 20_000);

/** The marker's file name inside the Vault's folder; the Vault itself reads and writes other names only. */
export const probeMarkerName = "probe-marker";

/** How a harness's sandbox is asked to run `cat <path>`: the whole command line, or null when none can run here. */
export type Wrapper = (path: string) => { readonly args: ReadonlyArray<string>; readonly command: string } | null;

const denial = (harness: HarnessName, status: VaultDenial["status"], reason: string): VaultDenial => ({
  harness,
  reason,
  status,
});

/** The probe's outcome from what its three reads gave; pure, so each branch is checked without a sandbox. */
export const judgeDenial = (
  harness: HarnessName,
  reads: {
    /** The marker, read outside any sandbox. */
    readonly outside: CommandRun;
    /** A file outside the Vault's folder, read inside the sandbox: proves the sandbox ran and reads. */
    readonly insideControl: CommandRun;
    /** The marker, read inside the sandbox. */
    readonly insideMarker: CommandRun;
  },
  secrets: { readonly control: string; readonly marker: string },
): VaultDenial => {
  if (!reads.outside.stdout.includes(secrets.marker))
    return denial(harness, "Unverified", "The marker could not be read outside the sandbox, so nothing was tried.");
  if (!reads.insideControl.stdout.includes(secrets.control))
    return denial(harness, "Unverified", "A command could not be run inside its sandbox here.");
  if (reads.insideMarker.stdout.includes(secrets.marker))
    return denial(harness, "Unverified", "A command inside its sandbox could read the Vault's folder.");
  return reads.insideMarker.code === 0
    ? denial(harness, "Unverified", "A command inside its sandbox read the marker's file but showed nothing of it.")
    : denial(
        harness,
        "Verified",
        "A command inside its sandbox could not read the Vault's folder, and one outside could.",
      );
};

/**
 * Tries the marker read for one harness through its sandbox's own wrapper: makes the marker in the folder and a
 * control file beside it, reads each as `judgeDenial` needs, and removes both. A host without `/bin/cat`, or with no
 * sandbox to wrap with, is Unverified.
 */
export const probeVaultDenial = (
  harness: HarnessName,
  folder: string,
  wrap: Wrapper,
  run: RunCommand = runReal,
): Effect.Effect<VaultDenial> =>
  Effect.gen(function* () {
    if (process.platform === "win32") return denial(harness, "Unverified", "No probe exists for Windows yet.");
    const secrets = { control: randomBytes(16).toString("hex"), marker: randomBytes(16).toString("hex") };
    const scratch = mkdtempSync(join(tmpdir(), "outlore-vault-probe-"));
    const markerPath = join(folder, probeMarkerName);
    const controlPath = join(scratch, "control");
    try {
      mkdirSync(folder, { mode: 0o700, recursive: true });
      writeFileSync(markerPath, secrets.marker, { mode: 0o600 });
      chmodSync(markerPath, 0o600);
      writeFileSync(controlPath, secrets.control, { mode: 0o644 });
      const insideControl = wrap(controlPath);
      const insideMarker = wrap(markerPath);
      if (insideControl === null || insideMarker === null)
        return denial(harness, "Unverified", "Its sandbox cannot run here.");
      return judgeDenial(
        harness,
        {
          insideControl: yield* run(insideControl.command, insideControl.args),
          insideMarker: yield* run(insideMarker.command, insideMarker.args),
          outside: yield* run("/bin/cat", [markerPath]),
        },
        secrets,
      );
    } catch (error) {
      return denial(harness, "Unverified", `The probe could not be set up: ${(error as Error).message}`);
    } finally {
      rmSync(markerPath, { force: true });
      rmSync(scratch, { force: true, recursive: true });
    }
  });

/** Whether the harness's executable starts at all: a missing one, or one that does not answer, is not installed here. */
export const isInstalled = (command: string, prefixArgs: ReadonlyArray<string>, run: RunCommand = runReal) =>
  run(command, [...prefixArgs, "--version"]).pipe(Effect.map(({ code }) => code !== null));
