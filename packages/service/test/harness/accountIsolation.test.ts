import { chmodSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { harnessNames } from "@outlore/contracts";
import { Effect } from "effect";
import {
  type AccountIsolation,
  computerOnlyIsolation,
  isolationEnvOf,
  needsConfiguredHomeOf,
  singleVarIsolation,
} from "../../src/harness/accountIsolation.ts";
import { type AcpProviderDefinition, acpLaunchOf, acpSignInOf } from "../../src/harness/acpProviderDefinition.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "../../src/harness/acpProviders.ts";
import { accountEnvironmentOf, harnessFacts, refusesAddedAccounts } from "../../src/harness/harnessCatalog.ts";
import { harnesses } from "../../src/harness/harnesses.ts";
import { acpFakeDefinition, acpFakeEnv, acpFakeRequest, acpFakeScript, readAcpFakeLog } from "../fixtures/acpFake.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// One declarative account isolation (accountIsolation.ts) per harness: the launch, the sign-in, the sign-in read, the model probe, the plan limits and the Workshop's
// "+ Add account" all derive from it, so none of them can disagree about where an account's sign-in lives.

afterEach(() => vi.unstubAllEnvs());

describe("deriving the isolation environment", () => {
  const multiVariable: AccountIsolation = {
    envOf: (accountDirectory) => ({ ONE_DIR: accountDirectory, TWO_DIR: join(accountDirectory, "data") }),
    kind: "directory",
  };

  it("gives a directory isolation every variable it names, for an account's folder only", () => {
    expect(isolationEnvOf(singleVarIsolation("ONE_HOME"), "/accounts/a")).toEqual({ ONE_HOME: "/accounts/a" });
    expect(isolationEnvOf(multiVariable, "/accounts/a")).toEqual({
      ONE_DIR: "/accounts/a",
      TWO_DIR: join("/accounts/a", "data"),
    });
    expect(isolationEnvOf(multiVariable, null)).toEqual({});
  });

  it("gives a harness no folder can isolate no variable at all", () => {
    expect(isolationEnvOf(computerOnlyIsolation("shared keychain"), "/accounts/a")).toEqual({});
  });

  it("asks for a configured home only where the isolation says so", () => {
    expect(needsConfiguredHomeOf(singleVarIsolation("HOME_A", true))).toBe(true);
    expect(needsConfiguredHomeOf(singleVarIsolation("HOME_A"))).toBe(false);
    expect(needsConfiguredHomeOf(computerOnlyIsolation("shared keychain"))).toBe(false);
  });
});

describe("the harness roster", () => {
  const computerOnly = ["antigravity", "cline", "copilot", "cursor", "devin", "muse"];

  it("refuses added accounts for exactly the harnesses whose isolation is computer-only", () => {
    expect(harnessNames.filter((name) => refusesAddedAccounts(name)).sort()).toEqual(computerOnly);
    for (const name of harnessNames)
      expect(harnessFacts[name].isolation.kind).toBe(computerOnly.includes(name) ? "computerOnly" : "directory");
  });

  it("points each directory-isolated harness at an account's folder with the variable it has always used", () => {
    const variables = {
      claude: "CLAUDE_CONFIG_DIR",
      codex: "CODEX_HOME",
      hermes: "HERMES_HOME",
      opencode: "XDG_DATA_HOME",
      pi: "PI_CODING_AGENT_DIR",
      vibe: "VIBE_HOME",
    } as const;
    for (const [name, variable] of Object.entries(variables) as Array<[keyof typeof variables, string]>) {
      expect(accountEnvironmentOf(name, "/accounts/a")).toEqual({ [variable]: "/accounts/a" });
      expect(accountEnvironmentOf(name, null)).toEqual({});
    }
  });

  it("gives a sign-in command the same variable the harness runs with", () => {
    for (const name of ["claude", "codex", "hermes", "opencode", "vibe"] as const)
      expect(harnessFacts[name].signIn("/accounts/a")?.env).toMatchObject(accountEnvironmentOf(name, "/accounts/a"));
  });

  it("points no computer-only harness anywhere, whatever folder a stale account row names", () => {
    for (const name of computerOnly)
      expect(accountEnvironmentOf(name as (typeof harnessNames)[number], "/accounts/a")).toEqual({});
  });
});

// An ACP provider shaped like the ones the later batches enable: two variables for the account, a home the argv binds,
// and one resolution of that home for the computer's own sign-in.
describe("one ACP definition drives the launch, the sign-in and the probe alike", () => {
  const logged = ["ONE_DIR", "TWO_DIR", "PIN_HOME"];

  const definitionOf = (log: string): AcpProviderDefinition => {
    const argv = (home: string | null) => ["acp", `--home=${home ?? "unpinned"}`];
    return acpFakeDefinition({
      argv,
      isolation: {
        envOf: (accountDirectory) => ({ ONE_DIR: accountDirectory, TWO_DIR: join(accountDirectory, "data") }),
        kind: "directory",
      },
      pinnedHome: { resolve: (env) => env.PIN_DEFAULT ?? "/computer/home", variable: "PIN_HOME" },
      signIn: { argv: (home) => [...argv(home), "--login"], extraEnv: {}, keepsPath: true },
      spawnEnv: acpFakeEnv(log, { logEnv: logged, mode: "probe" }),
    });
  };

  const inFolder = <A, E, R>(check: (log: string, directory: string) => Effect.Effect<A, E, R>) => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-isolation-"));
    return check(join(directory, "calls"), directory).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  };

  it.live("gives the launch, the probe and the sign-in one argv and one environment for an account", () =>
    inFolder((log, directory) =>
      Effect.gen(function* () {
        const account = join(directory, "account");
        const definition = definitionOf(log);
        const expectedArgv = ["acp", `--home=${account}`];
        const expectedEnv = { ONE_DIR: account, PIN_HOME: account, TWO_DIR: join(account, "data") };

        yield* probeAcpProviderModels({
          command: process.execPath,
          configDirectory: account,
          definition,
          prefixArgs: [acpFakeScript],
        });
        const probed = acpFakeRequest(log, "session/new").launch;
        expect(probed?.argv).toEqual(expectedArgv);
        expect(probed?.env).toEqual(expectedEnv);

        const turnLog = `${log}-turn`;
        const harness = yield* makeAcpProviderHarness({
          command: process.execPath,
          definition: definitionOf(turnLog),
          env: acpFakeEnv(turnLog, { logEnv: logged }),
          idleTimeout: "10 minutes",
          prefixArgs: [acpFakeScript],
        });
        yield* harness.runTurn(turnRequestOf({ configDirectory: account, text: "Hello" }));
        const turned = acpFakeRequest(turnLog, "initialize").launch;
        expect(turned?.argv).toEqual(expectedArgv);
        expect(turned?.env).toEqual(expectedEnv);

        const signIn = acpSignInOf(definition, { configDirectory: account });
        expect(signIn?.args).toEqual([...expectedArgv, "--login"]);
        expect(signIn?.env).toMatchObject(expectedEnv);
        expect(acpLaunchOf(definition, { configDirectory: account }).env).toMatchObject(expectedEnv);
      }),
    ),
  );

  it.live("gives the computer's own sign-in the pinned home alone, in the argv and in the variable", () =>
    inFolder((log) =>
      Effect.gen(function* () {
        yield* probeAcpProviderModels({
          command: process.execPath,
          definition: definitionOf(log),
          prefixArgs: [acpFakeScript],
        });
        const probed = acpFakeRequest(log, "session/new").launch;
        expect(probed?.argv).toEqual(["acp", "--home=/computer/home"]);
        expect(probed?.env).toEqual({ ONE_DIR: null, PIN_HOME: "/computer/home", TWO_DIR: null });
        const signIn = acpSignInOf(definitionOf(log));
        expect(signIn?.args).toEqual(["acp", "--home=/computer/home", "--login"]);
        expect(signIn?.env.PIN_HOME).toBe("/computer/home");
      }),
    ),
  );

  it("never lets a stale account folder move a computer-only provider off the computer's pinned home", () => {
    const definition = { ...definitionOf("/dev/null"), isolation: computerOnlyIsolation("unproven") };
    const own = acpLaunchOf(definition);
    expect(acpLaunchOf(definition, { configDirectory: "/accounts/stale" })).toEqual(own);
    expect(own.args).toEqual(["acp", "--home=/computer/home"]);
  });
});

// The registry's own Hermes entry, started through a wrapper that runs the ACP stand-in: its configured-home rule now lives in the
// isolation, so the model list must still refuse the computer's own folder and read an account's.
describe.skipIf(process.platform === "win32")("listing Hermes models from the registry", () => {
  const standIn = () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-isolation-hermes-"));
    const command = join(directory, "hermes");
    const log = join(directory, "calls");
    writeFileSync(command, `#!/bin/sh\nexec node ${JSON.stringify(acpFakeScript)} "$@"\n`);
    chmodSync(command, 0o755);
    for (const [name, value] of Object.entries(acpFakeEnv(log, { logEnv: ["HERMES_HOME"], mode: "probe" })))
      vi.stubEnv(name, value);
    return { command, directory, log };
  };

  it("lists none, and starts nothing, for the computer's own folder", async () => {
    const { command, directory, log } = standIn();
    try {
      expect(await Effect.runPromise(harnesses.hermes.readModels(command, null))).toEqual([]);
      expect(existsSync(log)).toBe(false);
    } finally {
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });

  it("probes an account's folder as HERMES_HOME", async () => {
    const { command, directory, log } = standIn();
    try {
      const models = await Effect.runPromise(harnesses.hermes.readModels(command, "/accounts/hermes"));
      expect(models.length).toBeGreaterThan(0);
      const launch = readAcpFakeLog(log).find((entry) => entry.launch !== undefined)?.launch;
      expect(launch?.env.HERMES_HOME).toBe("/accounts/hermes");
    } finally {
      rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 });
    }
  });
});
