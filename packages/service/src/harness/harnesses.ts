import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffortChoice, HarnessName, ModelOption } from "@outlore/contracts";
import { type Duration, Effect, Queue, Record, type Scope } from "effect";
import {
  fieldOf,
  type HarnessAdapter,
  reducedEnvironmentOf,
  routeHarnesses,
  runShortCommand,
  type ServiceFailure,
  startRpcProcess,
  textFieldOf,
} from "../core/index.ts";
import { type AcpProviderDefinition, acpLaunchOf } from "./acpProviderDefinition.ts";
import { makeAcpProviderHarness, probeAcpProviderModels, readAcpProviderSignIn } from "./acpProviders.ts";
import { readAntigravityPlanLimits } from "./antigravityPlanLimits.ts";
import { antigravity as antigravityProvider } from "./antigravityProvider.ts";
import { makeClaudeHarness } from "./claude.ts";
import { cline as clineProvider } from "./clineProvider.ts";
import { makeCodexHarness } from "./codex.ts";
import { copilot as copilotProvider } from "./copilotProvider.ts";
import { cursor as cursorProvider } from "./cursorProvider.ts";
import { devin as devinProvider } from "./devinProvider.ts";
import { accountEnvironmentOf, claudeModels, type HarnessFacts, harnessFacts } from "./harnessCatalog.ts";
import type { SignInStatus } from "./harnessTools.ts";
import { hermes as hermesProvider } from "./hermesProvider.ts";
import { makeMuseHarness } from "./muse.ts";
import { listMuseModels, readMuseSignIn } from "./museAccount.ts";
import { detectOpenCodeSandbox, type OpenCodeSandbox } from "./openCodeSandbox.ts";
import { listOpenCodeEfforts, makeOpenCodeHarness } from "./opencode.ts";
import { makePiHarness } from "./pi.ts";
import { probePiModels } from "./piRpc.ts";
import { makeVibeHarness } from "./vibe.ts";
import { listVibeModels, readVibeSignIn } from "./vibeAccount.ts";

// The harness registry (provider-accounts): each harness defined once, by its facts, its turn adapter, and what Outlore asks its own tool about sign-in and models.
// `makeHarnessRouter` derives its entries from `harnesses`.

/**
 * What a check replaces about how a harness starts, so a stand-in runs through the registry's own registration glue (Muse's update flag, Hermes's account home, Antigravity's pinned home, the tool-server wiring) and only the executable differs.
 * Each field is one a stand-in needs; the app never sets any of them.
 */
export type LaunchOverride = {
  /**
   * Environment added to the process's own, such as a stand-in's knobs; it wins over the registration's.
   * Only the adapters that give their process an environment of its own take it: Muse, Pi and the ACP providers.
   * The rest start with the service's environment, which a check sets directly.
   */
  readonly env?: Record<string, string>;
  /** Where each OpenCode thread's starting context is written; the service's data folder by default. */
  readonly instructionsFolder?: string;
  /** The sandbox OpenCode runs in instead of the one detected for this host, or null to run it unwrapped. */
  readonly openCodeSandbox?: OpenCodeSandbox | null;
  /** Arguments placed before the harness's own, to run a stand-in script in the executable's place. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** The Claude Code settings file read for the owner's rules, in place of the computer's own. */
  readonly userSettingsPath?: string;
};

/** What every harness's turn adapter is started with in the app. */
export type AdapterOptions = {
  /** The executable. */
  readonly command: string;
  /** The service's own folder, where a wrapped OpenCode keeps its state; the system's temporary folder when left out. */
  readonly dataDirectory?: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** What a check replaces about how the harness starts; absent in the app. */
  readonly launch?: LaunchOverride;
  /** Why the sandbox cannot run here, or null (CHG-0031). */
  readonly sandboxProblem: string | null;
  /** The Vault's folder, hidden from every sandbox (ADR 0022); none when left out, in checks. */
  readonly vaultFolder?: string;
};

/** One harness: its facts, its turn adapter, and its tool's answers about sign-in and models. */
export interface HarnessDefinition extends HarnessFacts {
  /** The adapter running the harness's turns, whose processes close with the scope that made it. */
  readonly makeAdapter: (options: AdapterOptions) => Effect.Effect<HarnessAdapter, never, Scope.Scope>;
  /**
   * The effort levels the harness offers for one model, for a harness whose model list does not hold them; the
   * others give them with each model (`ModelOption.efforts`). Fails when the harness could not be asked, which is not
   * the same as a model that has none (empty).
   */
  readonly readEfforts?: (
    command: string,
    configDirectory: string | null,
    model: string,
  ) => Effect.Effect<ReadonlyArray<EffortChoice>, ServiceFailure>;
  /** The models the harness offers with an account's sign-in, its default first. */
  readonly readModels: (command: string, configDirectory: string | null) => Effect.Effect<ReadonlyArray<ModelOption>>;
  /** Who the harness's tool says is signed in, given the account's environment; never a credential. */
  readonly readSignIn: (command: string, env: Record<string, string>) => Effect.Effect<SignInStatus>;
}

/** The prefix arguments of an override, as the adapters' options take them. */
const prefixOf = (launch: LaunchOverride | undefined) =>
  launch?.prefixArgs === undefined ? {} : { prefixArgs: launch.prefixArgs };

const unknownSignIn: SignInStatus = { detail: null, signIn: "Unknown" };
const signedOut: SignInStatus = { detail: null, signIn: "SignedOut" };

/** The effort levels Codex offers for one model, as its list says, lowest first. */
const codexEffortsOf = (model: unknown): Array<EffortChoice> => {
  const supported = fieldOf(model, "supportedReasoningEfforts");
  if (!Array.isArray(supported)) return [];
  return supported.flatMap((option): Array<EffortChoice> => {
    const level = textFieldOf(option, "reasoningEffort");
    return level !== null && level !== "default" ? [level] : [];
  });
};

/** Codex's models, read from its app server's own list. */
const listCodexModels = Effect.fnUntraced(
  function* (command: string, configDirectory: string | null) {
    const rpc = yield* startRpcProcess({
      args: ["app-server"],
      command,
      cwd: tmpdir(),
      env: reducedEnvironmentOf(accountEnvironmentOf("codex", configDirectory)),
      isJsonRpc2: false,
      label: "Codex",
    });
    const listed = yield* Effect.gen(function* () {
      yield* rpc.request("initialize", {
        capabilities: { experimentalApi: true, requestAttestation: false },
        clientInfo: { name: "outlore", title: "Outlore", version: "0.0.0" },
      });
      rpc.notify("initialized", {});
      return yield* rpc.request("model/list", {});
    }).pipe(Effect.timeout("20 seconds"), Effect.ensuring(Effect.sync(() => rpc.close())));
    yield* Queue.shutdown(rpc.incoming);
    const data = fieldOf(listed, "data");
    return Array.isArray(data)
      ? data.flatMap((model): Array<ModelOption> => {
          const id = textFieldOf(model, "id");
          return id === null || fieldOf(model, "hidden") === true
            ? []
            : [{ efforts: codexEffortsOf(model), id, label: textFieldOf(model, "displayName") ?? id }];
        })
      : [];
  },
  Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
);

const claude: HarnessDefinition = {
  ...harnessFacts.claude,
  makeAdapter: ({ command, idleTimeout, launch, sandboxProblem, vaultFolder }) =>
    makeClaudeHarness({
      command,
      idleTimeout,
      sandboxProblem,
      ...prefixOf(launch),
      ...(launch?.userSettingsPath === undefined ? {} : { userSettingsPath: launch.userSettingsPath }),
      ...(vaultFolder === undefined ? {} : { vaultFolder }),
    }),
  readModels: () => Effect.succeed(claudeModels),
  readSignIn: Effect.fnUntraced(function* (command: string, env: Record<string, string>) {
    const { stdout } = yield* runShortCommand(command, ["auth", "status", "--json"], env);
    let status: unknown = null;
    try {
      status = JSON.parse(stdout);
    } catch {
      return unknownSignIn;
    }
    if (fieldOf(status, "loggedIn") !== true) return signedOut;
    const plan = textFieldOf(status, "subscriptionType");
    const email = textFieldOf(status, "email");
    return {
      detail: [email, plan === null ? null : `Claude ${plan}`].filter((part) => part !== null).join(" · ") || null,
      signIn: "SignedIn",
    } satisfies SignInStatus;
  }),
};

const codex: HarnessDefinition = {
  ...harnessFacts.codex,
  makeAdapter: ({ command, idleTimeout, launch, vaultFolder }) =>
    makeCodexHarness({
      command,
      idleTimeout,
      ...prefixOf(launch),
      ...(vaultFolder === undefined ? {} : { vaultFolder }),
    }),
  readModels: (command, configDirectory) => listCodexModels(command, configDirectory),
  readSignIn: (command, env) =>
    runShortCommand(command, ["login", "status"], env).pipe(
      Effect.map(({ code, output }): SignInStatus => {
        const text = output.trim();
        if (code === null) return unknownSignIn;
        return code === 0 && /logged in/i.test(text)
          ? { detail: text.replace(/^logged in using /i, "") || null, signIn: "SignedIn" }
          : signedOut;
      }),
    ),
};

const opencode: HarnessDefinition = {
  ...harnessFacts.opencode,
  makeAdapter: ({ command, dataDirectory, idleTimeout, launch, sandboxProblem, vaultFolder }) =>
    makeOpenCodeHarness({
      command,
      idleTimeout,
      ...(launch?.instructionsFolder === undefined ? {} : { instructionsFolder: launch.instructionsFolder }),
      ...prefixOf(launch),
      sandbox:
        launch?.openCodeSandbox !== undefined
          ? launch.openCodeSandbox
          : detectOpenCodeSandbox({
              ...(vaultFolder === undefined ? {} : { hidden: [vaultFolder] }),
              platform: process.platform,
              root: join(dataDirectory ?? tmpdir(), "opencode-sandbox"),
              sandboxProblem,
            }),
    }),
  readEfforts: listOpenCodeEfforts,
  readModels: (command, configDirectory) =>
    runShortCommand(command, ["models"], accountEnvironmentOf("opencode", configDirectory)).pipe(
      Effect.map(({ stdout }) =>
        stdout
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => /^[\w.-]+\/\S+$/.test(line))
          .map((id) => ({ id, label: id })),
      ),
    ),
  // OpenCode lists one line per stored sign-in, each naming its provider.
  readSignIn: (command, env) =>
    runShortCommand(command, ["auth", "list"], env).pipe(
      Effect.map(({ code, stdout }): SignInStatus => {
        if (code === null) return unknownSignIn;
        const providers = stdout
          .split("\n")
          .filter((line) => /\bstored\b/.test(line))
          .map((line) => line.split(/\s{2,}/)[0]?.trim() ?? "")
          .filter((name) => name !== "");
        return providers.length === 0 ? signedOut : { detail: providers.join(", "), signIn: "SignedIn" };
      }),
    ),
};

const vibe: HarnessDefinition = {
  ...harnessFacts.vibe,
  makeAdapter: ({ command, idleTimeout, launch }) => makeVibeHarness({ command, idleTimeout, ...prefixOf(launch) }),
  readModels: (command, configDirectory) => listVibeModels(command, configDirectory),
  readSignIn: (command, env) => readVibeSignIn(command, env),
};

/** One long-lived ACP process per thread, started from the provider's definition when the adapter is built. */
const acpAdapterOf =
  (provider: AcpProviderDefinition) =>
  ({ command, idleTimeout, launch }: AdapterOptions) =>
    Effect.suspend(() =>
      makeAcpProviderHarness({
        command,
        idleTimeout,
        ...prefixOf(launch),
        profile: acpLaunchOf(provider, launch?.env === undefined ? {} : { env: launch.env }),
      }),
    );

/** The models of a short-lived session probe on the provider's launch; none when the CLI is absent or not signed in. */
const probedModelsOf = (provider: AcpProviderDefinition) => (command: string) =>
  Effect.suspend(() => probeAcpProviderModels({ command, profile: acpLaunchOf(provider) })).pipe(
    Effect.map((models): ReadonlyArray<ModelOption> => models),
    Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
  );

const hermes: HarnessDefinition = {
  ...harnessFacts.hermes,
  // Hermes runs through the generic ACP adapter: every permission request reaches the owner, modes are forced to
  // "ask" where the provider offers them, and the account folder becomes HERMES_HOME (acpProviders.ts).
  makeAdapter: acpAdapterOf(hermesProvider),
  // Models come from the ACP probe against the account's own (prepared) home; the computer's own Hermes directory is
  // never probed, and a home that is not set up yet (no repair, no sign-in, no model) lists none yet.
  readModels: (command, configDirectory) =>
    configDirectory === null
      ? Effect.succeed([])
      : probeAcpProviderModels({ command, profile: acpLaunchOf(hermesProvider), stateHome: configDirectory }).pipe(
          Effect.map((models): ReadonlyArray<ModelOption> => models),
          Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
        ),
  // Hermes offers no machine-readable sign-in status a read-only command can answer; an account shows Unknown until
  // its prepared home starts listing models.
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const muse: HarnessDefinition = {
  ...harnessFacts.muse,
  // Muse runs through its MSP adapter: every approval reaches the owner, a turn that cannot be mediated stops
  // rather than guessing, and the CLI's self-update stays suppressed (muse.ts).
  makeAdapter: ({ command, idleTimeout, launch }) =>
    makeMuseHarness({ command, env: { MUSE_NO_AUTO_UPDATE: "1", ...launch?.env }, idleTimeout, ...prefixOf(launch) }),
  // The models come from a short-lived `muse serve` host's own list; none when the CLI is not installed.
  readModels: (command) =>
    listMuseModels(command).pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([]))),
  // The device sign-in needs a terminal and the account probe rides experimental MSP, so an account shows
  // Unknown until a live check proves a surface.
  readSignIn: () => readMuseSignIn(),
};

const pi: HarnessDefinition = {
  ...harnessFacts.pi,
  // Pi runs fail-closed: every tool source of its own is denied for good on each turn, every question it asks is
  // answered cancelled, and a turn that runs a tool anyway ends as a breach (piTools.ts); nothing Outlore has not
  // approved ever runs (CHG-0644, provider-parity wave 3).
  makeAdapter: ({ command, idleTimeout, launch }) =>
    makePiHarness({
      command,
      idleTimeout,
      ...(launch?.env === undefined ? {} : { env: launch.env }),
      ...prefixOf(launch),
      provider: "pi",
    }),
  // Models come from a short-lived RPC probe of the running CLI - against the account's own directory for an
  // added account, against the computer's own Pi otherwise; none when the CLI is absent or not signed in yet.
  readModels: (command, configDirectory) =>
    probePiModels({
      command,
      ...(configDirectory === null ? {} : { configDirectory }),
      provider: "pi",
    }).pipe(
      Effect.map((models): ReadonlyArray<ModelOption> => models),
      Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
    ),
  // Pi offers no sign-in status a read-only command answers; an account shows Unknown until its models list.
  readSignIn: () => Effect.succeed(unknownSignIn),
};

// The ACP provider harnesses (CHG-0645, provider-parity wave 5): each runs one long-lived ACP process of the
// generic adapter, so every sensitive action reaches the owner as a permission request and any other reverse
// request fails closed. All of them take the computer's own sign-in only (their added-account surfaces are absent or
// unproven - supportsAddedAccounts stays false). Their launch, model probe, sign-in and version gate all come from
// one definition each (acpProviderDefinition.ts), so none of them can drift from another.

const antigravity: HarnessDefinition = {
  ...harnessFacts.antigravity,
  // The plan limits come from the CLI's own `/usage` command, which spends no tokens (antigravityPlanLimits.ts).
  makeAdapter: (options) =>
    acpAdapterOf(antigravityProvider)(options).pipe(
      Effect.map(
        (adapter): HarnessAdapter => ({
          ...adapter,
          readPlanLimits: (_harness, configDirectory) =>
            configDirectory === null
              ? readAntigravityPlanLimits({
                  command: options.command,
                  env: acpLaunchOf(
                    antigravityProvider,
                    options.launch?.env === undefined ? {} : { env: options.launch.env },
                  ).env,
                  ...prefixOf(options.launch),
                })
              : Effect.succeed(null),
        }),
      ),
    ),
  // Models come from a short-lived session probe against the computer's own Gemini home; none when the CLI is
  // absent or not signed in.
  readModels: probedModelsOf(antigravityProvider),
  // The same session probe answers the sign-in: models listed means the computer's login works.
  readSignIn: (command) => readAcpProviderSignIn({ command, definition: antigravityProvider }),
};

const cline: HarnessDefinition = {
  ...harnessFacts.cline,
  makeAdapter: acpAdapterOf(clineProvider),
  readModels: probedModelsOf(clineProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const copilot: HarnessDefinition = {
  ...harnessFacts.copilot,
  makeAdapter: acpAdapterOf(copilotProvider),
  // A signed-out Copilot answers with no models rather than failing, so the probe failing at all (the CLI absent)
  // reads as no models yet, exactly as upstream's signed-out shape does.
  readModels: probedModelsOf(copilotProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const cursor: HarnessDefinition = {
  ...harnessFacts.cursor,
  makeAdapter: acpAdapterOf(cursorProvider),
  readModels: probedModelsOf(cursorProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const devin: HarnessDefinition = {
  ...harnessFacts.devin,
  makeAdapter: acpAdapterOf(devinProvider),
  // Devin lists models only when signed in, so both the signed-out probe and any probe failure read as none yet.
  readModels: probedModelsOf(devinProvider),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

/** Every harness, by name. */
export const harnesses = {
  antigravity,
  claude,
  cline,
  codex,
  copilot,
  cursor,
  devin,
  hermes,
  muse,
  opencode,
  pi,
  vibe,
} satisfies Record<HarnessName, HarnessDefinition>;

/**
 * The adapter the app runs turns through: each harness's own, started from its definition (provider-accounts).
 * A check passes `launches` to run stand-ins in the executables' place; it is the only way a test builds the router, so the registration glue runs in the suite.
 */
export const makeHarnessRouter = (
  commands: Record<HarnessName, string>,
  options: Omit<AdapterOptions, "command" | "launch">,
  launches: Partial<Record<HarnessName, LaunchOverride>> = {},
) =>
  Effect.all(
    Record.map(harnesses, (definition, name) => {
      const launch = launches[name];
      return definition.makeAdapter({
        ...options,
        command: commands[name],
        ...(launch === undefined ? {} : { launch }),
      });
    }),
  ).pipe(Effect.map(routeHarnesses));
