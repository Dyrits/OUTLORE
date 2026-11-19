import { createHash } from "node:crypto";
import { closeSync, fsyncSync, lstatSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Clock, Effect, Schema } from "effect";
import type { VaultDenial } from "../core/index.ts";
import { sandboxSettingsOf } from "./claudeArgs.ts";

// The stamp the owner-run live probe leaves in the Vault's folder (ADR 0022): the one verified answer to "does
// Claude Code's sandbox hide this folder" that a probe at start cannot give, because Claude Code applies its sandbox
// only inside a live model turn. The stamp is keyed to the Claude Code version and a hash of the sandbox settings the
// adapter writes, so a new version or changed settings make it stale and the Vault refuses to store a secret again
// until the probe is run once more.

/** The stamp's file name inside the Vault's folder; the folder itself is denied to sandboxed commands. */
export const claudeDenialStampName = "claude-denial-stamp.json";

/** What the live probe verified, and for which version and settings. */
export const DenialStamp = Schema.Struct({
  /** SHA-256 of the sandbox settings the adapter writes for the Vault's folder, as JSON. */
  settingsHash: Schema.String,
  /** When the live probe verified the denial, as an ISO date. */
  verifiedAt: Schema.String,
  /** The Claude Code version that was probed, the first token of its `--version` output. */
  version: Schema.String,
});
export type DenialStamp = typeof DenialStamp.Type;

/** What a stamp is keyed to: the running version and the denial-relevant settings, hashed. */
export type DenialStampKey = {
  readonly settingsHash: string;
  readonly version: string;
};

/**
 * The key of the current state: the version given, and the hash of the sandbox settings the adapter writes for this
 * Vault folder. The per-thread worktree list is not part of the key: it never touches the folder's denial, and
 * including it would make every worktree change refuse storage.
 */
export const denialStampKeyOf = (version: string, folder: string): DenialStampKey => ({
  settingsHash: createHash("sha256")
    .update(JSON.stringify(sandboxSettingsOf([], folder)))
    .digest("hex"),
  version,
});

/** Reads the stamp in the folder; a missing, unreadable or undecodable one is none. */
export const readDenialStamp = (folder: string): Effect.Effect<DenialStamp | null> =>
  Effect.sync(() => {
    const path = join(folder, claudeDenialStampName);
    const found = lstatSync(path, { throwIfNoEntry: false });
    if (found === undefined || !found.isFile()) return null;
    try {
      return Schema.decodeUnknownSync(DenialStamp)(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      return null;
    }
  });

/** Writes the stamp whole, by rename, so a crash leaves the old one: mode 0600 like the Vault's own files. */
export const writeDenialStamp = (folder: string, stamp: DenialStamp): Effect.Effect<void, Error> =>
  Effect.try({
    catch: () => new Error("The denial stamp could not be written."),
    try: () => {
      const path = join(folder, claudeDenialStampName);
      const temporary = `${path}.${process.pid}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(stamp)}\n`, { mode: 0o600 });
      const descriptor = openSync(temporary, "r");
      try {
        fsyncSync(descriptor);
      } finally {
        closeSync(descriptor);
      }
      renameSync(temporary, path);
    },
  });

/** The stamp's verdict against the current key: verified, or stale with the reason the owner reads. */
export const judgeDenialStamp = (
  harness: VaultDenial["harness"],
  stamp: DenialStamp,
  key: DenialStampKey,
): VaultDenial => {
  if (stamp.version === key.version && stamp.settingsHash === key.settingsHash)
    return {
      harness,
      reason: `Verified by the live probe on ${stamp.verifiedAt} (Claude Code ${stamp.version}); the sandbox settings are unchanged.`,
      status: "Verified",
    };
  return {
    harness,
    reason: `The live probe verified this on ${stamp.verifiedAt} for ${
      stamp.version === key.version ? "different sandbox settings" : `Claude Code ${stamp.version}`
    }; run it again to verify the current one.`,
    status: "Unverified",
  };
};

/** The stamp a verified live probe leaves, keyed to the version and the folder's settings. */
export const stampForVerifiedProbe = (version: string, folder: string) =>
  Effect.map(Clock.currentTimeMillis, (millis): DenialStamp => {
    const key = denialStampKeyOf(version, folder);
    return { settingsHash: key.settingsHash, verifiedAt: new Date(millis).toISOString(), version };
  });
