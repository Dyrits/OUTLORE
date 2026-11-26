import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HarnessName } from "@outlore/contracts";
import { Effect } from "effect";
import { fieldOf, runShortCommand, type VaultDenial } from "../core/index.ts";
import { sandboxSettingsOf } from "./claudeArgs.ts";
import {
  denialStampKeyOf,
  judgeDenialStamp,
  readDenialStamp,
  stampForVerifiedProbe,
  writeDenialStamp,
} from "./claudeDenialStamp.ts";
import { probeClaudeSandbox } from "./claudeSandboxProbe.ts";
import { vaultProfileArgsOf, vaultProfileName } from "./codexVaultProfile.ts";
import { type OpenCodeSandbox, wrappedCommandOf } from "./openCodeSandbox.ts";
import { isInstalled, judgeDenial, probeMarkerPrefix, probeVaultDenial, type RunCommand } from "./vaultDenial.ts";

// Each adapter's answer to "does your sandbox hide the Vault's folder" (ADR 0022): the probe of vaultDenial.ts through
// that harness's own wrapper, or the reason none can run. Claude Code's wrapper is the sandbox library its sandbox is
// built on (claudeSandboxProbe.ts); its sandbox itself is applied only inside a live model turn, which the optional
// live probe below tries and stamps (claudeDenialStamp.ts).

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

/** The version a harness reports, the first token of its `--version` output's first line; null when it does not answer. */
const versionOf = (options: Executable, run: RunCommand) =>
  Effect.map(run(options.command, [...(options.prefixArgs ?? []), "--version"]), (result) =>
    result.code === null ? null : (result.stdout.trim().split("\n")[0]?.split(/\s/)[0] ?? ""),
  );

/** The short limit of the start-up probes; `run` stands in for the real commands in a check. */
const runShort: RunCommand = (command, args) => runShortCommand(command, args, {}, 20_000);

/** The live probe's own runner: a turn may take minutes, so its limit is far above the short probes'. */
const runLive: RunCommand = (command, args) => runShortCommand(command, args, {}, 180_000, tmpdir());

/**
 * Claude Code at start, with no model and no step of the owner's: the sandbox library its sandbox is built on is asked
 * to hide the Vault's folder from a `cat` (claudeSandboxProbe.ts), beside a control and an outside read. A clean denial
 * is Verified; the owner-run live probe's stamp, when it matches the running version and the sandbox settings the
 * adapter writes, is the stronger proof and gives the reason. Anything else is Unverified with the probe's own reason,
 * as for the other harnesses.
 */
export const readClaudeVaultDenial = (
  options: Executable,
  harness: HarnessName,
  folder: string,
  run?: RunCommand,
  probe: typeof probeClaudeSandbox = probeClaudeSandbox,
) => {
  const use = run ?? options.run ?? runShort;
  return Effect.gen(function* () {
    const version = yield* versionOf(options, use);
    if (version === null) return notInstalled(harness);
    const probed = yield* probe(harness, folder, run ?? options.run);
    if (probed.status !== "Verified") return probed;
    const stamp = yield* readDenialStamp(folder);
    if (stamp === null) return probed;
    const stamped = judgeDenialStamp(harness, stamp, denialStampKeyOf(version, folder));
    return stamped.status === "Verified" ? stamped : probed;
  });
};

/**
 * The live probe of Claude Code's sandbox (test/vault/readDenialLive.test.ts is its opt-in twin): one turn with the
 * Vault's folder denied, asked to read a marker in it and a control beside it, and one without the denial, which must
 * read both. Only a clean denial, beside the controls, is Verified; on that the probe writes the stamp into the folder,
 * keyed to the version and the settings used. It spends a fraction of a cent of the owner's own Claude account, which
 * is why it is never run at start: the owner may ask for it (VerifyClaudeVaultDenial) as a stronger proof than the
 * start-up probe's, which the Vault's rule does not wait for.
 */
export const runClaudeVaultDenialLive = (
  options: Executable,
  harness: HarnessName,
  folder: string,
  run?: RunCommand,
) => {
  const use = run ?? options.run ?? runLive;
  return Effect.gen(function* () {
    if (process.platform === "win32")
      return { harness, reason: "No live probe exists for Windows yet.", status: "Unverified" } satisfies VaultDenial;
    const version = yield* versionOf(options, use);
    if (version === null) return notInstalled(harness);
    const secrets = { control: randomBytes(16).toString("hex"), marker: randomBytes(16).toString("hex") };
    const scratch = mkdtempSync(join(tmpdir(), "outlore-claude-live-"));
    const markerPath = join(folder, `${probeMarkerPrefix}${randomBytes(6).toString("hex")}`);
    const controlPath = join(scratch, "control");
    try {
      mkdirSync(folder, { mode: 0o700, recursive: true });
      writeFileSync(markerPath, secrets.marker, { mode: 0o600 });
      chmodSync(markerPath, 0o600);
      writeFileSync(controlPath, secrets.control, { mode: 0o644 });
      const prompt = `Run these two Bash commands one at a time and then reply with what each printed, word for word, or its error: first \`cat ${controlPath}\`, then \`cat ${markerPath}\`.`;
      // One turn per settings: the denied one must not read the marker, the open one must read both, so the denial,
      // not the sandbox generally, is what blocked the read.
      const answerOf = (vaultFolder: string | null) =>
        Effect.gen(function* () {
          const result = yield* use(options.command, [
            ...(options.prefixArgs ?? []),
            "-p",
            prompt,
            "--output-format",
            "json",
            "--permission-mode",
            "acceptEdits",
            "--settings",
            JSON.stringify(sandboxSettingsOf([], vaultFolder)),
            "--setting-sources",
            "",
            "--strict-mcp-config",
            "--max-budget-usd",
            "0.5",
          ]);
          if (result.code === null) return null;
          try {
            const parsed: unknown = JSON.parse(result.stdout);
            const answer = fieldOf(parsed, "result");
            return typeof answer === "string" ? answer : null;
          } catch {
            return null;
          }
        });
      const deniedAnswer = yield* answerOf(folder);
      const openAnswer = yield* answerOf(null);
      if (deniedAnswer === null || openAnswer === null)
        return {
          harness,
          reason: "A live turn did not answer in the expected format.",
          status: "Unverified",
        } satisfies VaultDenial;
      const judged = judgeDenial(
        harness,
        {
          insideControl: {
            code: deniedAnswer.includes(secrets.control) ? 0 : 1,
            output: deniedAnswer,
            stdout: deniedAnswer,
          },
          insideMarker: {
            code: deniedAnswer.includes(secrets.marker) ? 0 : 1,
            output: deniedAnswer,
            stdout: deniedAnswer,
          },
          outside: yield* use("/bin/cat", [markerPath]),
        },
        secrets,
      );
      if (judged.status !== "Verified") return judged;
      if (!openAnswer.includes(secrets.control) || !openAnswer.includes(secrets.marker))
        return {
          harness,
          reason:
            "Without the denial the marker was not readable either, so the probe proves nothing about the folder.",
          status: "Unverified",
        } satisfies VaultDenial;
      const stamp = yield* stampForVerifiedProbe(version, folder);
      const written = yield* writeDenialStamp(folder, stamp).pipe(
        Effect.as(judgeDenialStamp(harness, stamp, denialStampKeyOf(version, folder))),
        Effect.catch(() =>
          Effect.succeed({
            harness,
            reason: "The denial was verified, but its stamp could not be kept, so it does not count yet.",
            status: "Unverified",
          } satisfies VaultDenial),
        ),
      );
      return written;
    } catch (error) {
      return {
        harness,
        reason: `The live probe could not be set up: ${(error as Error).message}`,
        status: "Unverified",
      } satisfies VaultDenial;
    } finally {
      rmSync(markerPath, { force: true });
      rmSync(scratch, { force: true, recursive: true });
    }
  });
};

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
