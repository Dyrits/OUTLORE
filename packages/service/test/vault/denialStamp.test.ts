import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { sandboxSettingsOf } from "../../src/harness/claudeArgs.ts";
import {
  claudeDenialStampName,
  denialStampKeyOf,
  judgeDenialStamp,
  readDenialStamp,
  stampForVerifiedProbe,
  writeDenialStamp,
} from "../../src/harness/claudeDenialStamp.ts";
import type { RunCommand } from "../../src/harness/vaultDenial.ts";
import { readClaudeVaultDenial, runClaudeVaultDenialLive } from "../../src/harness/vaultDenials.ts";
import { fakeClaudeLiveRun } from "../fixtures/fakeClaudeLive.ts";
import { temporary } from "../fixtures/service.ts";

const version = "2.1.326";

/** A `--version`-only stand-in for the start-up probe. */
const versionRun =
  (reported: string | null): RunCommand =>
  (_command, args) =>
    args.includes("--version")
      ? Effect.succeed(
          reported === null ? { code: null, output: "", stdout: "" } : { code: 0, output: reported, stdout: reported },
        )
      : Effect.succeed({ code: 1, output: "", stdout: "" });

describe("the stamp the live probe leaves", () => {
  it("is keyed to the version and a hash of the sandbox settings the adapter writes", () => {
    const folder = temporary("outlore-stamp-");
    const key = denialStampKeyOf(version, folder);
    expect(key.version).toBe(version);
    // The hash covers the settings with the folder denied; a different folder changes them, and so the key.
    expect(key.settingsHash).toHaveLength(64);
    expect(denialStampKeyOf(version, join(folder, "other")).settingsHash).not.toBe(key.settingsHash);
    expect(denialStampKeyOf("2.2.0", folder).settingsHash).toBe(key.settingsHash);
    expect(JSON.parse(JSON.stringify(sandboxSettingsOf([], folder))).sandbox.filesystem.denyRead).toEqual([folder]);
  });

  it.effect("round-trips through its file, and a missing or broken one reads as none", () =>
    Effect.gen(function* () {
      const folder = temporary("outlore-stamp-");
      expect(yield* readDenialStamp(folder)).toBeNull();
      const stamp = yield* stampForVerifiedProbe(version, folder);
      yield* writeDenialStamp(folder, stamp);
      expect(yield* readDenialStamp(folder)).toEqual(stamp);
      expect(readdirSync(folder)).toEqual([claudeDenialStampName]);
      writeFileSync(join(folder, claudeDenialStampName), "not json");
      expect(yield* readDenialStamp(folder)).toBeNull();
    }),
  );

  it("judges a matching stamp Verified, and a stale one Unverified with what changed", () => {
    const folder = temporary("outlore-stamp-");
    const key = denialStampKeyOf(version, folder);
    const stamp = { settingsHash: key.settingsHash, verifiedAt: "2026-11-19T12:00:00.000Z", version };
    expect(judgeDenialStamp("claude", stamp, key)).toMatchObject({ status: "Verified" });
    expect(judgeDenialStamp("claude", stamp, key).reason).toContain(version);
    expect(judgeDenialStamp("claude", stamp, { ...key, version: "2.2.0" })).toMatchObject({ status: "Unverified" });
    expect(judgeDenialStamp("claude", stamp, { ...key, version: "2.2.0" }).reason).toContain("2.1.326");
    expect(judgeDenialStamp("claude", stamp, { ...key, settingsHash: "other" }).reason).toContain(
      "different sandbox settings",
    );
  });
});

describe("Claude Code's denial at start, from the stamp", () => {
  it.effect(
    "is Unverified with no stamp, Verified with a matching one, stale after a version change, NotInstalled when absent",
    () =>
      Effect.gen(function* () {
        const folder = temporary("outlore-stamp-");
        const options = { command: "claude", run: versionRun(`${version} (Claude Code)`) };
        expect(yield* readClaudeVaultDenial(options, "claude", folder)).toMatchObject({ status: "Unverified" });
        yield* writeDenialStamp(folder, yield* stampForVerifiedProbe(version, folder));
        const verified = yield* readClaudeVaultDenial(options, "claude", folder);
        expect(verified).toMatchObject({ status: "Verified" });
        expect(verified.reason).toContain(version);
        const upgraded = { command: "claude", run: versionRun("2.2.0 (Claude Code)") };
        const stale = yield* readClaudeVaultDenial(upgraded, "claude", folder);
        expect(stale).toMatchObject({ status: "Unverified" });
        expect(stale.reason).toContain("2.1.326");
        expect(
          yield* readClaudeVaultDenial({ command: "claude", run: versionRun(null) }, "claude", folder),
        ).toMatchObject({
          status: "NotInstalled",
        });
      }),
  );
});

describe("the owner-run live probe", () => {
  it.effect("verifies a clean denial and writes the stamp, leaving no marker behind", () =>
    Effect.gen(function* () {
      const folder = temporary("outlore-live-");
      const options = { command: "claude", run: fakeClaudeLiveRun(version) };
      const report = yield* runClaudeVaultDenialLive(options, "claude", folder);
      expect(report).toMatchObject({ status: "Verified" });
      expect(report.reason).toContain(version);
      expect(existsSync(join(folder, claudeDenialStampName))).toBe(true);
      expect(yield* readDenialStamp(folder)).toMatchObject({ version });
      expect(readdirSync(folder)).toEqual([claudeDenialStampName]);
      // The stamp now answers the start-up probe too.
      expect(yield* readClaudeVaultDenial(options, "claude", folder)).toMatchObject({ status: "Verified" });
    }),
  );

  it.effect("fails closed when the denied turn reads the marker, and writes no stamp", () =>
    Effect.gen(function* () {
      const folder = temporary("outlore-live-");
      const report = yield* runClaudeVaultDenialLive(
        { command: "claude", run: fakeClaudeLiveRun(version, { deniedTurnReadsMarker: true }) },
        "claude",
        folder,
      );
      expect(report).toMatchObject({ status: "Unverified" });
      expect(report.reason).toContain("could read the Vault's folder");
      expect(existsSync(join(folder, claudeDenialStampName))).toBe(false);
      expect(readdirSync(folder)).toEqual([]);
    }),
  );

  it.effect("proves nothing when the marker is unreadable even without the denial", () =>
    Effect.gen(function* () {
      const folder = temporary("outlore-live-");
      const report = yield* runClaudeVaultDenialLive(
        { command: "claude", run: fakeClaudeLiveRun(version, { openTurnReadsMarker: false }) },
        "claude",
        folder,
      );
      expect(report).toMatchObject({ status: "Unverified" });
      expect(report.reason).toContain("proves nothing");
      expect(existsSync(join(folder, claudeDenialStampName))).toBe(false);
    }),
  );

  it.effect("says NotInstalled when claude does not answer, and Unverified when a turn does not answer in JSON", () =>
    Effect.gen(function* () {
      const folder = temporary("outlore-live-");
      expect(
        yield* runClaudeVaultDenialLive(
          { command: "claude", run: fakeClaudeLiveRun(version, { isNotInstalled: true }) },
          "claude",
          folder,
        ),
      ).toMatchObject({ status: "NotInstalled" });
      const garbled: RunCommand = (_command, args) =>
        args.includes("--version")
          ? Effect.succeed({ code: 0, output: version, stdout: version })
          : Effect.succeed({ code: 0, output: "not json", stdout: "not json" });
      expect(yield* runClaudeVaultDenialLive({ command: "claude", run: garbled }, "claude", folder)).toMatchObject({
        status: "Unverified",
      });
    }),
  );
});
