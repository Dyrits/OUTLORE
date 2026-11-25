import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import { singleVarIsolation } from "../../src/harness/accountIsolation.ts";
import { probeAcpProviderModels } from "../../src/harness/acpProviders.ts";
import { acpFakeDefinition, acpFakeEnv, acpFakeRequest, acpFakeScript, readAcpFakeLog } from "../fixtures/acpFake.ts";

describe("probing an ACP provider", () => {
  it.each(["models", "config"])("reads %s without prompting or providing MCP servers", async (form) => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    try {
      const models = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          definition: acpFakeDefinition({
            spawnEnv: acpFakeEnv(log, { form: form as "config" | "models", mode: "probe" }),
          }),
          prefixArgs: [acpFakeScript],
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
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });

  it("probes the computer's own sign-in when no account folder is given, redirecting nothing", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    try {
      const models = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          definition: acpFakeDefinition({
            isolation: singleVarIsolation("KIMI_CODE_HOME"),
            label: "fake Kimi",
            spawnEnv: acpFakeEnv(log, { form: "models", logEnv: ["KIMI_CODE_HOME"], mode: "probe" }),
          }),
          prefixArgs: [acpFakeScript],
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      expect(acpFakeRequest(log, "session/new").launch?.env.KIMI_CODE_HOME).toBeNull();
    } finally {
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });

  it("probes against the account's folder without creating it", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    const home = join(directory, "account-home");
    try {
      const models = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          configDirectory: home,
          definition: acpFakeDefinition({
            isolation: singleVarIsolation("HERMES_HOME", true),
            label: "fake Hermes",
            spawnEnv: acpFakeEnv(log, { form: "models", logEnv: ["HERMES_HOME"], mode: "probe" }),
          }),
          prefixArgs: [acpFakeScript],
        }),
      );
      expect(models).toEqual([{ id: "model-a", label: "Model A" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      // The account's folder is used verbatim: an account's prepared state stays as it is.
      expect(acpFakeRequest(log, "session/new").launch?.env.HERMES_HOME).toBe(home);
      expect(existsSync(home)).toBe(false);
    } finally {
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });

  it("refuses a probe of a configured-home provider without an account folder", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-test-"));
    const log = join(directory, "calls");
    try {
      const failure = await Effect.runPromise(
        probeAcpProviderModels({
          command: "node",
          definition: acpFakeDefinition({
            isolation: singleVarIsolation("HERMES_HOME", true),
            label: "fake Hermes",
            spawnEnv: acpFakeEnv(log, { form: "models", mode: "probe" }),
          }),
          prefixArgs: [acpFakeScript],
        }).pipe(Effect.flip),
      );
      expect(failure.reason).toContain("fake Hermes reads its models only from an account's configured folder");
      // Nothing runs against a folder that is not the account's, so no process was ever started.
      expect(existsSync(log)).toBe(false);
    } finally {
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });
});
