import { join } from "node:path";
import { Effect } from "effect";
import type { CommandResult } from "../commandRunner.ts";
import type { KeyCustody, KeyRead } from "../keyCustody.ts";
import { VaultFailure } from "../types.ts";

/** The exit code of the read script when the protected key's file is not there. */
const fileMissing = 3;

/** A PowerShell single-quoted string: the only escape inside one is a doubled quote. */
const quoted = (text: string) => `'${text.replaceAll("'", "''")}'`;

const readOf = (result: CommandResult): KeyRead => {
  if (result.code === fileMissing) return { _tag: "Gone" };
  if (result.code !== 0) return { _tag: "Unreachable", reason: "Windows could not unprotect the key." };
  const hex = result.stdout.trim();
  return /^[0-9a-f]{64}$/.test(hex)
    ? { _tag: "Found", key: Buffer.from(hex, "hex") }
    : { _tag: "Unreachable", reason: "The protected key is not a key." };
};

const powershellArgs = ["-NoProfile", "-NonInteractive", "-Command", "-"];

/**
 * Windows DPAPI for the current user, from PowerShell: the key is protected (only this Windows account can unprotect
 * it) and the protected bytes are kept in a file in the Vault's folder. The script, with the key in it, goes in on
 * standard input and never in a command line. Written to the same interface and tried with a stand-in runner only: no
 * Windows host was available (unverified, ADR 0022 Unchecked).
 */
export const windowsDpapi = (
  folder: string,
  run: (command: string, args: ReadonlyArray<string>, input: string) => Effect.Effect<CommandResult>,
): KeyCustody => {
  const fileOf = (keyId: string) => join(folder, `key-${keyId}.dpapi`);
  const script = (lines: ReadonlyArray<string>) => ["Add-Type -AssemblyName System.Security", ...lines].join("\n");
  return {
    holder: { isReadableFromSandbox: true, label: "Windows account", name: "windows" },
    read: (keyId) =>
      run(
        "powershell.exe",
        powershellArgs,
        script([
          `$path = ${quoted(fileOf(keyId))}`,
          `if (-not (Test-Path -LiteralPath $path)) { exit ${fileMissing} }`,
          "$bytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($path), $null, 'CurrentUser')",
          "[BitConverter]::ToString($bytes).Replace('-', '').ToLower()",
        ]),
      ).pipe(Effect.map(readOf)),
    remove: (keyId) =>
      run(
        "powershell.exe",
        powershellArgs,
        `Remove-Item -LiteralPath ${quoted(fileOf(keyId))} -Force -ErrorAction SilentlyContinue`,
      ).pipe(
        Effect.flatMap(({ code }) =>
          code === 0
            ? Effect.void
            : Effect.fail(
                new VaultFailure({ kind: "WriteFailed", message: "Windows would not remove the key's file." }),
              ),
        ),
      ),
    write: (keyId, key) =>
      run(
        "powershell.exe",
        powershellArgs,
        script([
          `$hex = ${quoted(key.toString("hex"))}`,
          "$bytes = [byte[]]::new($hex.Length / 2)",
          "for ($index = 0; $index -lt $bytes.Length; $index++) { $bytes[$index] = [Convert]::ToByte($hex.Substring($index * 2, 2), 16) }",
          "$protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, 'CurrentUser')",
          `[IO.File]::WriteAllBytes(${quoted(fileOf(keyId))}, $protected)`,
        ]),
      ).pipe(
        Effect.flatMap(({ code }) =>
          code === 0
            ? Effect.void
            : Effect.fail(new VaultFailure({ kind: "WriteFailed", message: "Windows would not protect the key." })),
        ),
      ),
  };
};
