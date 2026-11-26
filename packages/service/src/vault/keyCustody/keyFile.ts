import { chmodSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import type { KeyCustody, KeyRead } from "../keyCustody.ts";
import { VaultFailure } from "../types.ts";

const readOf = (path: string): KeyRead => {
  let text: string;
  try {
    text = readFileSync(path, "utf8").trim();
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
      ? { _tag: "Gone" }
      : { _tag: "Unreachable", reason: "The key file cannot be read." };
  }
  return /^[0-9a-f]{64}$/.test(text)
    ? { _tag: "Found", key: Buffer.from(text, "hex") }
    : { _tag: "Unreachable", reason: "The key file does not hold a key." };
};

/**
 * The fallback: a key file, mode 0600, in the Vault's folder. It lies beside the records, so it is no second layer,
 * and the Vault allows a secret only while the folder's read denial is verified for every harness (protection.ts).
 */
export const keyFile = (folder: string): KeyCustody => {
  const pathOf = (keyId: string) => join(folder, `key-${keyId}`);
  const failure = (message: string) => new VaultFailure({ kind: "WriteFailed", message });
  return {
    holder: {
      isReadableFromSandbox: true,
      label: "Key file: anyone who can read your files can read it",
      name: "keyFile",
    },
    read: (keyId) => Effect.sync(() => readOf(pathOf(keyId))),
    remove: (keyId) =>
      Effect.try({
        catch: () => failure("The key file could not be removed."),
        try: () => rmSync(pathOf(keyId), { force: true }),
      }),
    write: (keyId, key) =>
      Effect.try({
        catch: () => failure("The key file could not be written."),
        try: () => {
          mkdirSync(folder, { mode: 0o700, recursive: true });
          // Written beside its name and renamed, so a crash leaves no half key under the name.
          const temporary = `${pathOf(keyId)}.${process.pid}.tmp`;
          writeFileSync(temporary, `${key.toString("hex")}\n`, { mode: 0o600 });
          chmodSync(temporary, 0o600);
          renameSync(temporary, pathOf(keyId));
        },
      }),
  };
};
