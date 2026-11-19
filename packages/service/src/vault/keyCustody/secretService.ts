import { Effect } from "effect";
import type { CommandResult } from "../commandRunner.ts";
import type { KeyCustody, KeyRead } from "../keyCustody.ts";
import { VaultFailure } from "../types.ts";

const attributesOf = (keyId: string) => ["service", "outlore-vault", "keyid", keyId];

/** `secret-tool lookup` exits 1 with nothing on standard error when no item matches; any message means it could not ask. */
const readOf = (result: CommandResult): KeyRead => {
  if (result.code === 1 && result.stderr.trim() === "") return { _tag: "Gone" };
  if (result.code !== 0) return { _tag: "Unreachable", reason: "The secret service did not answer." };
  const hex = result.stdout.trim();
  return /^[0-9a-f]{64}$/.test(hex)
    ? { _tag: "Found", key: Buffer.from(hex, "hex") }
    : { _tag: "Unreachable", reason: "The secret service's item is not a key." };
};

/**
 * A Linux Secret Service through `secret-tool`, the key on standard input. Written to the same interface and tried
 * with a stand-in runner only: no Linux host with a session bus was available (unverified, ADR 0022 Unchecked).
 */
export const secretService = (
  run: (command: string, args: ReadonlyArray<string>, input: string) => Effect.Effect<CommandResult>,
): KeyCustody => ({
  holder: { isReadableFromSandbox: true, label: "Secret service", name: "secretService" },
  read: (keyId) => run("secret-tool", ["lookup", ...attributesOf(keyId)], "").pipe(Effect.map(readOf)),
  remove: (keyId) =>
    run("secret-tool", ["clear", ...attributesOf(keyId)], "").pipe(
      Effect.flatMap(({ code }) =>
        code === 0 || code === 1
          ? Effect.void
          : Effect.fail(
              new VaultFailure({ kind: "WriteFailed", message: "The secret service would not remove the key." }),
            ),
      ),
    ),
  write: (keyId, key) =>
    run("secret-tool", ["store", "--label=Outlore Vault key", ...attributesOf(keyId)], key.toString("hex")).pipe(
      Effect.flatMap(({ code }) =>
        code === 0
          ? Effect.void
          : Effect.fail(
              new VaultFailure({ kind: "WriteFailed", message: "The secret service would not keep the key." }),
            ),
      ),
    ),
});
