import {
  chmodSync,
  closeSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { VaultFailure } from "./types.ts";

// The Vault's folder and its files: made plain, written whole by rename, read only as plain files.

/** Writes a file whole: how the Vault replaces `path` with `text`. A check passes one that fails where it chooses. */
export type WriteFile = (path: string, text: string) => Effect.Effect<void, VaultFailure>;

/**
 * Makes the Vault's folder (mode 0700) a plain folder: anything else in its place, such as a link a sandboxed process
 * planted, is removed rather than followed (as openCodeSandbox.ts `makeOwnedFolder` does for OpenCode's folders).
 */
export const prepareVaultFolder = (folder: string) =>
  Effect.try({
    catch: () => new VaultFailure({ kind: "WriteFailed", message: "The Vault's folder could not be made." }),
    try: () => {
      const found = lstatSync(folder, { throwIfNoEntry: false });
      if (found !== undefined && !found.isDirectory()) rmSync(folder, { force: true });
      if (found === undefined || !found.isDirectory()) mkdirSync(folder, { mode: 0o700, recursive: true });
      chmodSync(folder, 0o700);
    },
  });

/** Writes a temporary file in the same folder, makes it durable and renames it over `path`: a crash leaves the old file. */
export const writeFileWhole: WriteFile = (path, text) =>
  Effect.try({
    catch: () => new VaultFailure({ kind: "WriteFailed", message: "The Vault could not write its file." }),
    try: () => {
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync(temporary, text, { mode: 0o600 });
      chmodSync(temporary, 0o600);
      const descriptor = openSync(temporary, "r");
      try {
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      renameSync(temporary, path);
    },
  });

/** What reading one of the Vault's files found. */
export type FileRead =
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Text"; readonly text: string }
  /** Not a plain file, or unreadable: the Vault is Corrupt and nothing is overwritten. */
  | { readonly _tag: "Bad"; readonly reason: string };

/** Reads a file in the Vault's folder if it is a plain file; a link or a folder in its place is Bad, never followed. */
export const readVaultFile = (folder: string, name: string): Effect.Effect<FileRead> =>
  Effect.sync(() => {
    const path = join(folder, name);
    const found = lstatSync(path, { throwIfNoEntry: false });
    if (found === undefined) return { _tag: "Missing" } as const;
    if (!found.isFile()) return { _tag: "Bad", reason: `${name} is not a plain file.` } as const;
    try {
      return { _tag: "Text", text: readFileSync(path, "utf8") } as const;
    } catch {
      return { _tag: "Bad", reason: `${name} cannot be read.` } as const;
    }
  });

/** Removes a file of the Vault's folder, ignoring one already gone. */
export const removeVaultFile = (folder: string, name: string) =>
  Effect.sync(() => rmSync(join(folder, name), { force: true }));
