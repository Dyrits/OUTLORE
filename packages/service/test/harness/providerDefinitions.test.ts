import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { acpLaunchOf, majorVersionAtLeast } from "../../src/harness/acpProviderDefinition.ts";
import { acpProviders } from "../../src/harness/acpProviderRoster.ts";
import { antigravity } from "../../src/harness/antigravityProvider.ts";
import { harnessFacts, harnessNames } from "../../src/harness/harnessCatalog.ts";
import { harnesses } from "../../src/harness/harnesses.ts";
import { kimi } from "../../src/harness/kimiProvider.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Each ACP provider is one definition (acpProviderDefinition.ts). The launch, the model probe, the sign-in and the
// inspection must all read it: a sign-in that stores its token where the launch never looks is what CHG-0676 fixed.

const providers = Object.entries(acpProviders).flatMap(([name, definition]) =>
  definition === undefined ? [] : [{ definition, name: name as (typeof harnessNames)[number] }],
);

describe("one definition per ACP provider", () => {
  it("covers exactly the harnesses that run through the generic ACP adapter", () => {
    expect(providers.map(({ name }) => name).sort()).toEqual([
      "antigravity",
      "cline",
      "copilot",
      "cursor",
      "devin",
      "hermes",
    ]);
    for (const { name } of providers) expect(harnessNames).toContain(name);
  });

  it("gives the catalog the executable, the legacy executable and the home variable instead of a second copy", () => {
    for (const { definition, name } of providers) {
      expect(harnessFacts[name].defaultExecutable).toBe(definition.executable);
      expect(harnessFacts[name].configVariable).toBe(definition.stateHome.variable);
      expect(harnessFacts[name].legacyExecutable).toBe(definition.legacyExecutable ?? null);
      expect(harnessFacts[name].label).toBe(definition.label);
      expect(harnessFacts[name].versionGate).toBe(definition.version);
    }
    expect(harnessFacts.antigravity.defaultExecutable).toBe("agy");
    expect(harnessFacts.antigravity.legacyExecutable).toBe("antigravity");
    expect(harnessFacts.cursor.defaultExecutable).toBe("cursor-agent");
  });

  it("makes every sign-in carry the whole spawn environment, so it stores where the launch reads", () => {
    for (const { definition, name } of providers) {
      const signIn = harnessFacts[name].signIn(null);
      if (signIn === null) continue;
      expect(signIn.env).toMatchObject(definition.spawnEnv);
      // The CHG-0676 cause: any WSL_DISTRO_NAME moves the CLI's token from the keychain to a file.
      expect(signIn.env).not.toHaveProperty("WSL_DISTRO_NAME");
      expect(acpLaunchOf(definition).env).not.toHaveProperty("WSL_DISTRO_NAME");
    }
  });

  it("opens the same Gemini home in the launch and in the sign-in, in the flag and in the variable", () => {
    const home = "/accounts/gemini-home";
    const launch = acpLaunchOf(antigravity, { configDirectory: home });
    const signIn = harnessFacts.antigravity.signIn(home);
    expect(launch.args).toEqual(["acp", `--gemini-dir=${home}`, "--app-data-dir=antigravity-acp"]);
    expect(launch.env.GEMINI_HOME).toBe(home);
    expect(signIn?.args).toEqual([...launch.args, "--login"]);
    expect(signIn?.env).toEqual({ ...launch.env });
  });

  it("resolves an unset Gemini home once, from the environment, for the launch and the sign-in alike", () => {
    expect(acpLaunchOf(antigravity, { processEnv: { GEMINI_HOME: "/from/env" } }).args).toContain(
      "--gemini-dir=/from/env",
    );
    vi.stubEnv("GEMINI_HOME", "/from/process");
    try {
      expect(acpLaunchOf(antigravity).env.GEMINI_HOME).toBe("/from/process");
      expect(harnessFacts.antigravity.signIn(null)?.env.GEMINI_HOME).toBe("/from/process");
      expect(harnessFacts.antigravity.signIn(null)?.args).toContain("--gemini-dir=/from/process");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("redirects Hermes to the account's folder only, and demands a configured one", () => {
    const hermes = acpProviders.hermes;
    expect(hermes).toBeDefined();
    if (hermes === undefined) return;
    const launch = acpLaunchOf(hermes);
    expect(launch).toMatchObject({ needsConfiguredStateHome: true, stateHomeEnv: "HERMES_HOME" });
    // The adapter sets the variable per thread; the sign-in has no adapter, so it carries the account folder itself.
    expect(launch.env).not.toHaveProperty("HERMES_HOME");
    expect(harnessFacts.hermes.signIn("/accounts/h")?.env).toEqual({ HERMES_HOME: "/accounts/h" });
    expect(harnessFacts.hermes.signIn(null)?.args).toEqual(["pm", "repair", "&&", "hermes", "--setup"]);
  });

  it("redirects nothing for a provider that takes the computer's own sign-in only", () => {
    for (const name of ["cursor", "copilot", "cline", "devin"] as const) {
      const definition = acpProviders[name];
      if (definition === undefined) throw new Error(`no definition for ${name}`);
      const launch = acpLaunchOf(definition, { configDirectory: "/accounts/x" });
      expect(launch.stateHomeEnv).toBeUndefined();
      expect(launch.env).toEqual(definition.spawnEnv);
      expect(harnessFacts[name].signIn("/accounts/x")?.env ?? {}).not.toHaveProperty(definition.stateHome.variable);
    }
  });

  it("names the sign-in of each provider and none for Devin, whose sign-in is its own ACP flow", () => {
    expect(harnessFacts.cursor.signIn(null)).toEqual({
      args: ["login"],
      env: { NO_OPEN_BROWSER: "1" },
      keepsPath: false,
    });
    expect(harnessFacts.copilot.signIn(null)).toEqual({
      args: ["login"],
      env: { COPILOT_AUTO_UPDATE: "false" },
      keepsPath: false,
    });
    expect(harnessFacts.cline.signIn(null)).toEqual({
      args: ["auth", "-p", "cline"],
      env: { CLINE_NO_AUTO_UPDATE: "1", CLINE_SESSION_BACKEND_MODE: "local" },
      keepsPath: false,
    });
    expect(harnessFacts.devin.signIn(null)).toBeNull();
  });

  it("keeps the other harnesses' own sign-in as the catalog states it", () => {
    expect(harnessFacts.claude.signIn("/accounts/c")).toEqual({
      args: ["auth", "login"],
      env: { CLAUDE_CONFIG_DIR: "/accounts/c" },
      keepsPath: false,
    });
    expect(harnessFacts.pi.signIn(null)).toEqual({ args: [], env: {}, keepsPath: false });
  });
});

describe("the version gates", () => {
  it("gates on a generation by the first number the binary prints", () => {
    const gate = majorVersionAtLeast(3);
    expect(gate.accepts("3.0.68")).toBe(true);
    expect(gate.accepts("4.1.0")).toBe(true);
    expect(gate.accepts("cline 3.0.1")).toBe(true);
    expect(gate.accepts("2.9.14")).toBe(false);
    expect(gate.accepts("")).toBe(false);
    expect(gate.accepts("unknown")).toBe(false);
  });

  it("accepts only the audited Kimi generation, which is no harness yet", () => {
    expect(kimi.version?.accepts("kimi, version 2.7.2")).toBe(true);
    expect(kimi.version?.accepts("kimi, version 1.6")).toBe(false);
    expect(kimi.stateHome).toMatchObject({ kind: "account", variable: "KIMI_CODE_HOME" });
    expect(acpLaunchOf(kimi).env).toMatchObject({ KIMI_CODE_DANGEROUS_COMMAND_GUARD: "true" });
    expect(harnessNames).not.toContain("kimi");
  });

  it("gates Cline on generation 3 and Antigravity on generation 1", () => {
    expect(harnessFacts.cline.versionGate?.accepts("2.9.14")).toBe(false);
    expect(harnessFacts.cline.versionGate?.accepts("3.0.68")).toBe(true);
    expect(harnessFacts.antigravity.versionGate?.accepts("1.5.16")).toBe(true);
    expect(harnessFacts.antigravity.versionGate?.accepts("0.9.0")).toBe(false);
  });

  it("gates Cursor on its dated build line and Copilot on a version line", () => {
    const cursor = harnessFacts.cursor.versionGate;
    expect(cursor?.accepts("2026.09.28-64d2043")).toBe(true);
    expect(cursor?.accepts("2026.10.01-10-52-16-3f8a2b1c")).toBe(true);
    expect(cursor?.accepts("  2026.09.28-64d2043\n")).toBe(true);
    expect(cursor?.accepts("0.1.2")).toBe(false);
    expect(cursor?.accepts("2026.09.28")).toBe(false);
    expect(cursor?.accepts("Cursor 2026.09.28-64d2043")).toBe(false);
    const copilot = harnessFacts.copilot.versionGate;
    expect(copilot?.accepts("Copilot CLI 1.0.105")).toBe(true);
    expect(copilot?.accepts("Copilot CLI v2.1.0")).toBe(true);
    expect(copilot?.accepts("1.2.3")).toBe(true);
    expect(copilot?.accepts("copilot, no version here")).toBe(false);
  });

  it("has no gate for a provider audited without one", () => {
    expect(harnessFacts.devin.versionGate).toBeNull();
    expect(harnessFacts.hermes.versionGate).toBeNull();
    expect(harnessFacts.claude.versionGate).toBeNull();
  });
});

// The registry's own entries, started through a wrapper script that runs the provider's stand-in: what the stand-in
// logs is what the real registry launched, so a probe or turn that stopped reading the definition would show here.
describe.skipIf(process.platform === "win32")("the registry reads the definition when it launches", () => {
  type Spec = {
    readonly fake: string;
    readonly logVariable: string;
    readonly modeVariable: string;
    /** What the stand-in logged of its environment, by definition spawn variable. */
    readonly seenEnv: (entries: ReadonlyArray<Record<string, unknown>>) => Record<string, unknown>;
  };
  const argvOf = (entries: ReadonlyArray<Record<string, unknown>>) => {
    const entry = entries.find((candidate) => Array.isArray(candidate.argv) || Array.isArray(candidate.args));
    return (entry?.argv ?? entry?.args) as ReadonlyArray<string> | undefined;
  };
  const specs = {
    antigravity: {
      fake: "antigravityProviderFake.mjs",
      logVariable: "ANTIGRAVITY_FAKE_LOG",
      modeVariable: "ANTIGRAVITY_FAKE_MODE",
      seenEnv: (entries) => ({
        AGY_CLI_DISABLE_AUTO_UPDATE: entries.find((entry) => "autoUpdateDisabled" in entry)?.autoUpdateDisabled,
      }),
    },
    cline: {
      fake: "clineProviderFake.mjs",
      logVariable: "CLINE_FAKE_LOG",
      modeVariable: "CLINE_FAKE_MODE",
      seenEnv: (entries) => {
        const entry = entries.find((candidate) => "backendMode" in candidate);
        return { CLINE_NO_AUTO_UPDATE: entry?.autoUpdateDisabled, CLINE_SESSION_BACKEND_MODE: entry?.backendMode };
      },
    },
    copilot: {
      fake: "copilotProviderFake.mjs",
      logVariable: "COPILOT_FAKE_LOG",
      modeVariable: "COPILOT_FAKE_MODE",
      seenEnv: (entries) => ({ COPILOT_AUTO_UPDATE: entries.find((entry) => "autoUpdate" in entry)?.autoUpdate }),
    },
    cursor: {
      fake: "cursorProviderFake.mjs",
      logVariable: "CURSOR_FAKE_LOG",
      modeVariable: "CURSOR_FAKE_MODE",
      seenEnv: () => ({}),
    },
    devin: {
      fake: "devinProviderFake.mjs",
      logVariable: "DEVIN_FAKE_LOG",
      modeVariable: "DEVIN_FAKE_MODE",
      seenEnv: () => ({}),
    },
  } as const satisfies Record<string, Spec>;

  /** A wrapper that runs the stand-in as the provider's executable, and the stand-in's log. */
  const standIn = (spec: Spec, mode: string) => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-registry-definition-"));
    const command = join(directory, "provider");
    const log = join(directory, "calls");
    writeFileSync(
      command,
      `#!/bin/sh\nexec node ${JSON.stringify(join(import.meta.dirname, "../fixtures", spec.fake))} "$@"\n`,
    );
    chmodSync(command, 0o755);
    vi.stubEnv(spec.logVariable, log);
    vi.stubEnv(spec.modeVariable, mode);
    const entries = () =>
      readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
    return { command, directory, entries };
  };

  for (const name of Object.keys(specs) as Array<keyof typeof specs>) {
    const spec = specs[name];
    const definition = acpProviders[name];
    if (definition === undefined) throw new Error(`no definition for ${name}`);

    it(`probes ${name} models on the definition's argv and spawn environment`, async () => {
      const { command, directory, entries } = standIn(spec, "probe");
      try {
        const models = await Effect.runPromise(harnesses[name].readModels(command, null));
        expect(models.length).toBeGreaterThan(0);
        const launch = acpLaunchOf(definition);
        expect(argvOf(entries())).toEqual([...launch.args]);
        for (const [key, value] of Object.entries(spec.seenEnv(entries())))
          expect(value, `${name} saw ${key}`).toBe(launch.env[key] ?? null);
      } finally {
        vi.unstubAllEnvs();
        rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
      }
    });

    it.live(`runs ${name} turns on the definition's argv and spawn environment`, () => {
      const { command, directory, entries } = standIn(spec, "turn");
      return Effect.gen(function* () {
        const harness = yield* harnesses[name].makeAdapter({
          command,
          idleTimeout: "10 minutes",
          sandboxProblem: null,
        });
        yield* harness.runTurn(turnRequestOf({ text: "run git push" }));
        const launch = acpLaunchOf(definition);
        expect(argvOf(entries())).toEqual([...launch.args]);
        for (const [key, value] of Object.entries(spec.seenEnv(entries())))
          expect(value, `${name} saw ${key}`).toBe(launch.env[key] ?? null);
      }).pipe(
        Effect.scoped,
        Effect.ensuring(
          Effect.sync(() => {
            vi.unstubAllEnvs();
            rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
          }),
        ),
      );
    });
  }

  it("reads the Antigravity sign-in from the same launch: models listed is signed in, the pinned code is signed out", async () => {
    const signedIn = standIn(specs.antigravity, "probe");
    try {
      expect(await Effect.runPromise(harnesses.antigravity.readSignIn(signedIn.command, {}))).toEqual({
        detail: null,
        signIn: "SignedIn",
      });
    } finally {
      vi.unstubAllEnvs();
      rmSync(signedIn.directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
    const signedOut = standIn(specs.antigravity, "signedout");
    try {
      expect(await Effect.runPromise(harnesses.antigravity.readSignIn(signedOut.command, {}))).toEqual({
        detail: null,
        signIn: "SignedOut",
      });
    } finally {
      vi.unstubAllEnvs();
      rmSync(signedOut.directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });
});
