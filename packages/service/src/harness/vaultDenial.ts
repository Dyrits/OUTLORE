import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import { type CommandRun, errorMessageOf, runShortCommand, type VaultDenial } from "../core/index.ts";

// The probe behind "Protected, or no secrets" (ADR 0022, connectors blueprint): for one harness, whether a process
// inside its sandbox can read a marker file in the Vault's folder. The marker is a disposable random string, never a
// secret. The probe fails closed: anything but a clean denial, beside a control that proves the sandbox ran and an
// outside read that proves the marker was there, is Unverified.

/** Runs a command and reports how it ended; the default runs the real one, a check passes a fake. */
export type RunCommand = (command: string, args: ReadonlyArray<string>) => Effect.Effect<CommandRun>;

/** The real command runner, with a short limit: a sandbox that starts answers at once. */
const runReal: RunCommand = (command, args) => runShortCommand(command, args, {}, 20_000);

/**
 * The start of a marker's file name inside the Vault's folder; the Vault itself reads and writes other names only.
 * Each probe adds a random suffix of its own: the harnesses are probed at the same time, and probes sharing one name
 * overwrote and removed each other's marker, so a slower one found another's text, or nothing, where it had written
 * its own ("The marker could not be read outside the sandbox").
 */
export const probeMarkerPrefix = "probe-marker-";

/** A command line that runs `cat <path>` inside a harness's sandbox. */
export type Wrapped = { readonly args: ReadonlyArray<string>; readonly command: string };

/**
 * How a harness's sandbox is asked to run `cat <path>`: the whole command line, or null when none can run here; an
 * effect when the sandbox has to be started first (Claude Code's library).
 */
export type Wrapper = (path: string) => Wrapped | null | Effect.Effect<Wrapped | null>;

/** What the owner reads when the service itself runs inside a sandbox: a second one cannot start there, which is no leak. */
export const nestedSandboxReason =
  "This service is itself running inside a sandbox, which stops a second one from starting, so nothing was tried. Run Outlore outside it to check.";

/**
 * Whether the service runs inside a sandbox of its own, which makes every sandbox it starts fail (`sandbox_apply:
 * Operation not permitted` on macOS): a reason in plain words, or null when a sandbox can start here. Only macOS has
 * the cheap test; elsewhere a sandbox that cannot start is reported by its own failure.
 */
export const nestedSandboxReasonOf = (run: RunCommand = runReal): Effect.Effect<string | null> =>
  process.platform !== "darwin"
    ? Effect.succeed(null)
    : run("/usr/bin/sandbox-exec", ["-p", "(version 1)(allow default)", "/usr/bin/true"]).pipe(
        Effect.map(({ code, output }) => (code !== 0 && output.includes("sandbox_apply") ? nestedSandboxReason : null)),
      );

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
    return denial(
      harness,
      "Unverified",
      reads.insideControl.output.includes("sandbox_apply")
        ? nestedSandboxReason
        : "A command could not be run inside its sandbox here.",
    );
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
 * Tries the marker read for one harness through its sandbox's own wrapper: makes the marker in the folder (under a
 * name of its own, so probes at the same time do not meet) and a control file beside it, reads each as `judgeDenial`
 * needs, and removes both. A host without `/bin/cat`, or with no sandbox to wrap with, is Unverified, and so is a
 * service that cannot write to the folder or read back what it wrote, which says so instead of blaming the folder.
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
    const markerPath = join(folder, `${probeMarkerPrefix}${randomBytes(6).toString("hex")}`);
    const controlPath = join(scratch, "control");
    try {
      const nested = yield* nestedSandboxReasonOf(run);
      if (nested !== null) return denial(harness, "Unverified", nested);
      try {
        mkdirSync(folder, { mode: 0o700, recursive: true });
        writeFileSync(markerPath, secrets.marker, { mode: 0o600 });
        chmodSync(markerPath, 0o600);
        writeFileSync(controlPath, secrets.control, { mode: 0o644 });
        // The service's own read of what it just wrote: a refusal here is the service's, not any harness's.
        if (readFileSync(markerPath, "utf8") !== secrets.marker) throw new Error("the marker read back differently");
      } catch (error) {
        return denial(
          harness,
          "Unverified",
          `This service cannot write and read back a file in the Vault's folder, so nothing was tried (it may run inside a sandbox): ${errorMessageOf(error)}`,
        );
      }
      const wrapped = (path: string) => {
        const made = wrap(path);
        return Effect.isEffect(made) ? made : Effect.succeed(made);
      };
      const insideControl = yield* wrapped(controlPath);
      const insideMarker = yield* wrapped(markerPath);
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
      return denial(harness, "Unverified", `The probe could not be run: ${errorMessageOf(error)}`);
    } finally {
      // Cleaning up must not hide the report: a folder that cannot be used cannot hold the marker either.
      try {
        rmSync(markerPath, { force: true });
      } catch {}
      rmSync(scratch, { force: true, recursive: true });
    }
  });

/** Whether the harness's executable starts at all: a missing one, or one that does not answer, is not installed here. */
export const isInstalled = (command: string, prefixArgs: ReadonlyArray<string>, run: RunCommand = runReal) =>
  run(command, [...prefixArgs, "--version"]).pipe(Effect.map(({ code }) => code !== null));
