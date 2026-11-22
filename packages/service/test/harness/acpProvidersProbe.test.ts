import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { probeAcpProviderModels } from "../../src/harness/acpProviders.ts";

describe("probing an ACP provider", () => {
  it.each(["models", "config"])("reads %s without prompting or providing MCP servers", async (form) => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    try {
      const models = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          prefixArgs: [join(import.meta.dirname, "../fixtures/acpProvidersFake.mjs")],
          profile: { args: [], env: { ACP_FAKE_FORM: form, ACP_FAKE_LOG: log }, label: "fake ACP" },
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entries = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(entries.filter((entry) => entry.method).map((entry) => entry.method)).toEqual([
        "initialize",
        "session/new",
      ]);
      expect(entries[1].params.mcpServers).toEqual([]);
      expect(entries[1].cwd).not.toBe(tmpdir());
      expect(existsSync(entries[1].cwd)).toBe(false);
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
          prefixArgs: [join(import.meta.dirname, "../fixtures/acpProvidersFake.mjs")],
          profile: {
            args: [],
            env: { ACP_FAKE_FORM: "models", ACP_FAKE_LOG: log },
            label: "fake Kimi",
            stateHomeEnv: "KIMI_CODE_HOME",
          },
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .find((parsed) => parsed.method === "session/new");
      // The fake's own cwd resolves the /var symlink on macOS, so compare with the probe-side cwd it was given.
      expect(entry.kimiCodeHome).toBe(join(entry.params.cwd, "state-home"));
      expect(existsSync(entry.cwd)).toBe(false);
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
          prefixArgs: [join(import.meta.dirname, "../fixtures/acpProvidersFake.mjs")],
          profile: {
            args: [],
            env: { ACP_FAKE_FORM: "models", ACP_FAKE_LOG: log },
            label: "fake Hermes",
            needsConfiguredStateHome: true,
            stateHomeEnv: "HERMES_HOME",
          },
          stateHome: home,
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line))
        .find((parsed) => parsed.method === "session/new");
      // The caller's home is used verbatim: an account's prepared state stays as it is.
      expect(entry.hermesHome).toBe(home);
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
          prefixArgs: [join(import.meta.dirname, "../fixtures/acpProvidersFake.mjs")],
          profile: {
            args: [],
            env: { ACP_FAKE_FORM: "models", ACP_FAKE_LOG: log },
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
