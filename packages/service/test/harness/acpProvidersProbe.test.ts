import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { probeAcpProviderModels } from "../../src/harness/acpProviders.ts";
import { acpFakeEnv, acpFakeRequest, acpFakeScript, readAcpFakeLog } from "../fixtures/acpFake.ts";

describe("probing an ACP provider", () => {
  it.each(["models", "config"])("reads %s without prompting or providing MCP servers", async (form) => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    try {
      const models = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          prefixArgs: [acpFakeScript],
          profile: {
            args: [],
            env: acpFakeEnv(log, { form: form as "config" | "models", mode: "probe" }),
            label: "fake ACP",
          },
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entries = readAcpFakeLog(log).filter((entry) => entry.method !== undefined);
      expect(entries.map((entry) => entry.method)).toEqual(["initialize", "session/new"]);
      expect(entries[1]?.params?.mcpServers).toEqual([]);
      // The probe runs in a folder of its own, removed once it has answered.
      const cwd = entries[1]?.params?.cwd as string;
      expect(cwd).not.toBe(tmpdir());
      expect(existsSync(cwd)).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("redirects a declared state home into the probe directory", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    try {
      const models = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          prefixArgs: [acpFakeScript],
          profile: {
            args: [],
            env: acpFakeEnv(log, { form: "models", logEnv: ["KIMI_CODE_HOME"], mode: "probe" }),
            label: "fake Kimi",
            stateHomeEnv: "KIMI_CODE_HOME",
          },
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = acpFakeRequest(log, "session/new");
      // The probe-side cwd it was given, since the fake's own resolves the /var symlink on macOS.
      const cwd = entry.params?.cwd as string;
      expect(entry.launch?.env.KIMI_CODE_HOME).toBe(join(cwd, "state-home"));
      expect(existsSync(cwd)).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("probes against a caller-supplied state home without creating it", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    const home = join(directory, "account-home");
    try {
      const models = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          prefixArgs: [acpFakeScript],
          profile: {
            args: [],
            env: acpFakeEnv(log, { form: "models", logEnv: ["HERMES_HOME"], mode: "probe" }),
            label: "fake Hermes",
            needsConfiguredStateHome: true,
            stateHomeEnv: "HERMES_HOME",
          },
          stateHome: home,
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      // The caller's home is used verbatim: an account's prepared state stays as it is.
      expect(acpFakeRequest(log, "session/new").launch?.env.HERMES_HOME).toBe(home);
      expect(existsSync(home)).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("refuses a probe of a configured-state profile without a state home", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    try {
      const failure = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          prefixArgs: [acpFakeScript],
          profile: {
            args: [],
            env: acpFakeEnv(log, { form: "models", mode: "probe" }),
            label: "fake Hermes",
            needsConfiguredStateHome: true,
            stateHomeEnv: "HERMES_HOME",
          },
        }).pipe(Effect.flip),
      );
      expect(failure.reason).toContain("HERMES_HOME");
      // Nothing runs against a home the caller did not vouch for, so no process was ever started.
      expect(existsSync(log)).toBe(false);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
