import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { singleVarIsolation } from "../../src/harness/accountIsolation.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "../../src/harness/acpProviders.ts";
import { acpAgentVersionOf, acpVersionAtLeast } from "../../src/harness/acpSession.ts";
import { antigravity } from "../../src/harness/antigravityProvider.ts";
import {
  type AcpFakeConfig,
  acpFakeDefinition,
  acpFakeEnv,
  acpFakeRequest,
  acpFakeRequests,
  acpFakeScript,
} from "../fixtures/acpFake.ts";
import { standInHarness, standInProbe } from "../fixtures/providerStandIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the shared ACP launch hygiene mechanisms: declarative minimum agent version from `initialize`,
// per-launch isolated temporary directory cleanup, and ambient environment prefix scrubbing.

const inFolder = <A, E, R>(check: (log: string, directory: string) => Effect.Effect<A, E, R>) => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-acp-hygiene-"));
  return check(join(directory, "calls"), directory).pipe(
    Effect.scoped,
    Effect.ensuring(
      Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
    ),
  );
};

const waitUntilGone = (path: string) =>
  Effect.promise(() => vi.waitFor(() => expect(existsSync(path)).toBe(false), { timeout: 5_000 }));

afterEach(() => vi.unstubAllEnvs());

describe("shared ACP startup agent version check", () => {
  const gatedAdapter = (log: string, config: AcpFakeConfig, minimumAgentVersion?: string) =>
    makeAcpProviderHarness({
      command: process.execPath,
      definition: acpFakeDefinition({
        spawnEnv: acpFakeEnv(log, config),
        ...(minimumAgentVersion === undefined ? {} : { protocol: { minimumAgentVersion } }),
      }),
      idleTimeout: "10 minutes",
      prefixArgs: [acpFakeScript],
    });

  it.live("accepts versions at or above minimumAgentVersion and rejects older versions before session/new", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const accepted = yield* gatedAdapter(`${log}-ok`, { agentVersion: "2.0.0" }, "2.0.0");
        const outcome = yield* accepted.runTurn(turnRequestOf({ text: "Hello" }));
        expect(outcome.sessionId).toBe("acp-1");

        const rejected = yield* gatedAdapter(`${log}-old`, { agentVersion: "1.9.9" }, "2.0.0");
        const failure = yield* rejected.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
        expect(failure.reason).toContain("fake ACP");
        expect(failure.reason).toContain("1.9.9");
        expect(failure.reason).toContain("2.0.0");
        expect(acpFakeRequests(`${log}-old`, "session/new")).toHaveLength(0);
      }),
    ),
  );

  it.live("enforces Antigravity's 1.5.0 minimum on turns and probes, while leaving ungated providers unaffected", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const antigravityOk = yield* standInHarness("antigravity", {
          env: acpFakeEnv(`${log}-agy-ok`, { agentVersion: "1.5.0" }),
          idleTimeout: "10 minutes",
          prefixArgs: [acpFakeScript],
        });
        expect((yield* antigravityOk.runTurn(turnRequestOf({ text: "Hello" }))).sessionId).toBe("acp-1");

        const antigravityOld = yield* standInHarness("antigravity", {
          env: acpFakeEnv(`${log}-agy-old`, { agentVersion: "1.4.9" }),
          idleTimeout: "10 minutes",
          prefixArgs: [acpFakeScript],
        });
        const turnFailure = yield* antigravityOld.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
        expect(turnFailure.reason).toContain("1.4.9");
        expect(turnFailure.reason).toContain("1.5.0");
        expect(acpFakeRequests(`${log}-agy-old`, "session/new")).toHaveLength(0);

        const probeFailure = yield* standInProbe(antigravity, {
          env: acpFakeEnv(`${log}-agy-probe-old`, { agentVersion: "1.4.9", mode: "probe" }),
          prefixArgs: [acpFakeScript],
        }).pipe(Effect.flip);
        expect(probeFailure.reason).toContain("1.4.9");
        expect(probeFailure.reason).toContain("1.5.0");

        const cursorOld = yield* standInHarness("cursor", {
          env: acpFakeEnv(`${log}-cursor-old`, { agentVersion: "0.1.0" }),
          idleTimeout: "10 minutes",
          prefixArgs: [acpFakeScript],
        });
        expect((yield* cursorOld.runTurn(turnRequestOf({ text: "Hello" }))).sessionId).toBe("acp-1");
      }),
    ),
  );
});

describe("shared ACP per-launch isolated temp directory", () => {
  const tempEnv = ["TMPDIR", "TMP", "TEMP"];

  it.live("passes a fresh temp dir as TMPDIR, TMP, and TEMP and removes it when the process exits", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-hygiene-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      let seenTempDir = "";
      yield* Effect.gen(function* () {
        const harness = yield* makeAcpProviderHarness({
          command: process.execPath,
          definition: acpFakeDefinition({
            hasIsolatedTempDir: true,
            spawnEnv: acpFakeEnv(log, { logEnv: tempEnv }),
          }),
          idleTimeout: "10 minutes",
          prefixArgs: [acpFakeScript],
        });
        yield* harness.runTurn(turnRequestOf({ text: "Hello" }));
        const env = acpFakeRequest(log, "initialize").launch?.env;
        expect(env?.TMPDIR).toBeTruthy();
        expect(env?.TMP).toBe(env?.TMPDIR);
        expect(env?.TEMP).toBe(env?.TMPDIR);
        expect(env?.TMPDIR).not.toBe(tmpdir());
        seenTempDir = env?.TMPDIR ?? "";
        expect(existsSync(seenTempDir)).toBe(true);
      }).pipe(Effect.scoped);
      yield* waitUntilGone(seenTempDir);
    }).pipe(
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("isolates Antigravity's temp dir and cleans it up on version rejection or spawn failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-hygiene-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* standInHarness("antigravity", {
        env: acpFakeEnv(log, { agentVersion: "1.4.9", logEnv: tempEnv }),
        idleTimeout: "10 minutes",
        prefixArgs: [acpFakeScript],
      });
      yield* harness.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      const rejectedTempDir = acpFakeRequest(log, "initialize").launch?.env.TMPDIR ?? "";
      expect(rejectedTempDir).toContain("outlore-acp-tmp-");
      yield* waitUntilGone(rejectedTempDir);

      const before = new Set(readdirSync(tmpdir()).filter((name) => name.startsWith("outlore-acp-tmp-")));
      const missing = yield* makeAcpProviderHarness({
        command: "outlore-no-such-acp-binary",
        definition: acpFakeDefinition({ hasIsolatedTempDir: true, label: "missing ACP" }),
        idleTimeout: "10 minutes",
      });
      yield* missing.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      yield* Effect.promise(() =>
        vi.waitFor(
          () => {
            const after = readdirSync(tmpdir()).filter((name) => name.startsWith("outlore-acp-tmp-"));
            expect(after.filter((name) => !before.has(name))).toEqual([]);
          },
          { timeout: 5_000 },
        ),
      );
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("leaves providers without hasIsolatedTempDir on the inherited temp dir", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        const harness = yield* standInHarness("cursor", {
          env: acpFakeEnv(log, { logEnv: tempEnv }),
          idleTimeout: "10 minutes",
          prefixArgs: [acpFakeScript],
        });
        yield* harness.runTurn(turnRequestOf({ text: "Hello" }));
        // The stand-in logs a variable the launch did not carry as null, which is what a runner without TMPDIR inherits.
        expect(acpFakeRequest(log, "initialize").launch?.env.TMPDIR).toBe(process.env.TMPDIR ?? null);
      }),
    ),
  );
});

describe("shared ACP ambient environment scrubbing", () => {
  it.live(
    "strips matching ambient prefixes while keeping the account's isolation variable and spawnEnv overrides",
    () =>
      inFolder((log, directory) =>
        Effect.gen(function* () {
          vi.stubEnv("TEST_SCRUB_SECRET", "ambient-secret");
          vi.stubEnv("TEST_SCRUB_HOME", "/ambient/home");
          vi.stubEnv("TEST_UNRELATED_VAR", "keep-me");
          const account = join(directory, "account-home");
          const harness = yield* makeAcpProviderHarness({
            command: process.execPath,
            definition: acpFakeDefinition({
              isolation: singleVarIsolation("TEST_SCRUB_HOME"),
              scrubEnvPrefixes: ["TEST_SCRUB_"],
              spawnEnv: {
                ...acpFakeEnv(log, {
                  logEnv: ["TEST_SCRUB_SECRET", "TEST_SCRUB_HOME", "TEST_SCRUB_EXPLICIT", "TEST_UNRELATED_VAR"],
                }),
                TEST_SCRUB_EXPLICIT: "from-spawn-env",
              },
            }),
            idleTimeout: "10 minutes",
            prefixArgs: [acpFakeScript],
          });
          yield* harness.runTurn(turnRequestOf({ configDirectory: account, text: "Hello" }));
          const env = acpFakeRequest(log, "initialize").launch?.env;
          expect(env?.TEST_SCRUB_SECRET).toBeNull();
          expect(env?.TEST_SCRUB_HOME).toBe(account);
          expect(env?.TEST_SCRUB_EXPLICIT).toBe("from-spawn-env");
          expect(env?.TEST_UNRELATED_VAR).toBe("keep-me");
        }),
      ),
  );

  it.live("scrubs ambient GEMINI_* and GOOGLE_* on Antigravity turns and probes while keeping GEMINI_HOME", () =>
    inFolder((log, directory) =>
      Effect.gen(function* () {
        const geminiHome = join(directory, "gemini-home");
        vi.stubEnv("GEMINI_HOME", geminiHome);
        vi.stubEnv("GEMINI_API_KEY", "ambient-gemini-key");
        vi.stubEnv("GOOGLE_API_KEY", "ambient-google-key");
        vi.stubEnv("GOOGLE_CLOUD_PROJECT", "ambient-project");
        const logged = [
          "GEMINI_HOME",
          "GEMINI_API_KEY",
          "GOOGLE_API_KEY",
          "GOOGLE_CLOUD_PROJECT",
          "AGY_CLI_DISABLE_AUTO_UPDATE",
        ];

        const harness = yield* standInHarness("antigravity", {
          env: acpFakeEnv(`${log}-turn`, { logEnv: logged }),
          idleTimeout: "10 minutes",
          prefixArgs: [acpFakeScript],
        });
        yield* harness.runTurn(turnRequestOf({ text: "Hello" }));
        const turnEnv = acpFakeRequest(`${log}-turn`, "initialize").launch?.env;
        expect(turnEnv?.GEMINI_HOME).toBe(geminiHome);
        expect(turnEnv?.AGY_CLI_DISABLE_AUTO_UPDATE).toBe("true");
        expect(turnEnv?.GEMINI_API_KEY).toBeNull();
        expect(turnEnv?.GOOGLE_API_KEY).toBeNull();
        expect(turnEnv?.GOOGLE_CLOUD_PROJECT).toBeNull();

        yield* probeAcpProviderModels({
          command: process.execPath,
          definition: antigravity,
          env: acpFakeEnv(`${log}-probe`, { logEnv: logged, mode: "probe" }),
          prefixArgs: [acpFakeScript],
        });
        const probeEnv = acpFakeRequest(`${log}-probe`, "initialize").launch?.env;
        expect(probeEnv?.GEMINI_HOME).toBe(geminiHome);
        expect(probeEnv?.AGY_CLI_DISABLE_AUTO_UPDATE).toBe("true");
        expect(probeEnv?.GEMINI_API_KEY).toBeNull();
        expect(probeEnv?.GOOGLE_API_KEY).toBeNull();
        expect(probeEnv?.GOOGLE_CLOUD_PROJECT).toBeNull();
      }),
    ),
  );
});

describe("the agent's version, as initialize reports it", () => {
  it("reads agentInfo.version, and nothing when the agent names none", () => {
    expect(acpAgentVersionOf({ agentInfo: { name: "Antigravity ACP Server", version: "1.5.16" } })).toBe("1.5.16");
    expect(acpAgentVersionOf({ agentInfo: { name: "x" } })).toBeNull();
    expect(acpAgentVersionOf({})).toBeNull();
    expect(acpAgentVersionOf(null)).toBeNull();
  });

  it("compares the first three numbers, and an unreadable version is never at least anything", () => {
    expect(acpVersionAtLeast("1.5.0", "1.5.0")).toBe(true);
    expect(acpVersionAtLeast("1.5.16", "1.5.0")).toBe(true);
    expect(acpVersionAtLeast("1.10.0", "1.5.0")).toBe(true);
    expect(acpVersionAtLeast("2.0.0", "1.5.0")).toBe(true);
    expect(acpVersionAtLeast("1.4.99", "1.5.0")).toBe(false);
    expect(acpVersionAtLeast("v1.5.2-rc1", "1.5.0")).toBe(true);
    expect(acpVersionAtLeast("1.5", "1.5.0")).toBe(true);
    expect(acpVersionAtLeast("nightly", "1.5.0")).toBe(false);
    expect(acpVersionAtLeast(null, "1.5.0")).toBe(false);
  });
});
