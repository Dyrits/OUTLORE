import { Effect } from "effect";
import type { CommandResult } from "../commandRunner.ts";
import type { KeyCustody, KeyRead } from "../keyCustody.ts";
import { VaultFailure } from "../types.ts";

const account = "outlore";
const security = "/usr/bin/security";

/** The Keychain item's service name for a key identifier. */
export const keychainServiceOf = (keyId: string) => `outlore-vault-${keyId}`;

/** `security` exits 44 when no item matches (errSecItemNotFound). */
const itemNotFound = 44;

const readOf = (result: CommandResult): KeyRead => {
  if (result.code === itemNotFound) return { _tag: "Gone" };
  if (result.code !== 0) return { _tag: "Unreachable", reason: "The Keychain did not answer, or is locked." };
  const hex = result.stdout.trim();
  return /^[0-9a-f]{64}$/.test(hex)
    ? { _tag: "Found", key: Buffer.from(hex, "hex") }
    : { _tag: "Unreachable", reason: "The Keychain item is not a key." };
};

/**
 * The macOS Keychain through `security -i`, which takes the key on standard input, so it is never in a command line.
 * Tried on 2026-11-19: the item is added, read and removed this way, and it is readable from inside the sandboxes of
 * Claude Code, Codex and OpenCode, so it is no layer against a sandboxed command (documentation/verification/
 * 2026-11-19-vault-read-denial.md).
 */
export const macKeychain = (
  run: (command: string, args: ReadonlyArray<string>, input: string) => Effect.Effect<CommandResult>,
): KeyCustody => ({
  holder: { isReadableFromSandbox: true, label: "Keychain", name: "keychain" },
  read: (keyId) =>
    run(security, ["find-generic-password", "-a", account, "-s", keychainServiceOf(keyId), "-w"], "").pipe(
      Effect.map(readOf),
    ),
  remove: (keyId) =>
    run(security, ["delete-generic-password", "-a", account, "-s", keychainServiceOf(keyId)], "").pipe(
      Effect.flatMap(({ code }) =>
        code === 0 || code === itemNotFound
          ? Effect.void
          : Effect.fail(new VaultFailure({ kind: "WriteFailed", message: "The Keychain would not remove the key." })),
      ),
    ),
  write: (keyId, key) =>
    run(
      security,
      ["-i"],
      `add-generic-password -a ${account} -s ${keychainServiceOf(keyId)} -l "Outlore Vault key" -w ${key.toString("hex")} -U\n`,
    ).pipe(
      Effect.flatMap(({ code }) =>
        code === 0
          ? Effect.void
          : Effect.fail(new VaultFailure({ kind: "WriteFailed", message: "The Keychain would not keep the key." })),
      ),
    ),
});
