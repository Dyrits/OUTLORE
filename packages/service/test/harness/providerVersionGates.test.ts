import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { harnessNames } from "../../src/harness/harnessCatalog.ts";
import { HarnessTools, liveHarnessToolsLayer } from "../../src/index.ts";
import { temporary } from "../fixtures/service.ts";

// `inspect` runs the harness's own `--version`; a provider audited against one generation must be refused when
// the binary reports an older one, not just when it fails to run.

/** A stand-in executable that prints one version line and exits 0. */
const printing = (folder: string, name: string, line: string) => {
  const path = join(folder, name);
  writeFileSync(path, `#!/bin/sh\necho ${JSON.stringify(line)}\n`);
  chmodSync(path, 0o755);
  return path;
};

const inspectedWith = (harness: (typeof harnessNames)[number], line: string) => {
  const folder = temporary("outlore-version-gate-");
  const command = printing(folder, harness, line);
  const commands = Object.fromEntries(harnessNames.map((name) => [name, name === harness ? command : name]));
  return Effect.gen(function* () {
    const tools = yield* HarnessTools;
    return yield* tools.inspect(harness);
  }).pipe(Effect.provide(liveHarnessToolsLayer(commands as Record<(typeof harnessNames)[number], string>)));
};

describe.skipIf(process.platform === "win32")("inspecting a provider against its version gate", () => {
  it.live("refuses a Cline older than generation 3 and names the version it found", () =>
    Effect.gen(function* () {
      const old = yield* inspectedWith("cline", "2.9.14");
      expect(old.version).toBe("2.9.14");
      expect(old.problem).toContain("Cline");
      expect(old.problem).toContain("2.9.14");
      expect(old.problem).toContain("3");
      expect(yield* inspectedWith("cline", "3.0.68")).toEqual({ problem: null, version: "3.0.68" });
    }),
  );

  it.live("accepts Antigravity from generation 1 and refuses a binary that reports no number", () =>
    Effect.gen(function* () {
      expect((yield* inspectedWith("antigravity", "1.5.16")).problem).toBeNull();
      expect((yield* inspectedWith("antigravity", "0.9.0")).problem).toContain("Gemini (Antigravity)");
      expect((yield* inspectedWith("antigravity", "unknown")).problem).not.toBeNull();
    }),
  );

  it.live("refuses a Cursor and a Copilot whose version line is not the audited shape", () =>
    Effect.gen(function* () {
      expect((yield* inspectedWith("cursor", "2026.09.28-64d2043")).problem).toBeNull();
      expect((yield* inspectedWith("cursor", "0.1.2")).problem).toContain("Cursor");
      expect((yield* inspectedWith("copilot", "Copilot CLI 1.0.105")).problem).toBeNull();
      expect((yield* inspectedWith("copilot", "copilot, no version here")).problem).toContain("GitHub Copilot");
    }),
  );

  it.live("keeps accepting any version of a harness with no gate", () =>
    Effect.gen(function* () {
      expect((yield* inspectedWith("devin", "devin v0.0.1")).problem).toBeNull();
      expect((yield* inspectedWith("claude", "0.0.1 (Claude Code)")).problem).toBeNull();
    }),
  );
});
