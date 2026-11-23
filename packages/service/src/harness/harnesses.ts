import { tmpdir } from "node:os";
import { join } from "node:path";
import type { EffortChoice, HarnessName, ModelOption } from "@outlore/contracts";
import { type Duration, Effect, Queue, type Scope } from "effect";
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
import { acpProviderProfiles } from "./acpProviderProfiles.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "./acpProviders.ts";
import { makeAntigravityHarness, probeAntigravityModels } from "./antigravityProvider.ts";
import { makeClaudeHarness } from "./claude.ts";
import { makeClineHarness, probeClineModels } from "./clineProvider.ts";
import { makeCodexHarness } from "./codex.ts";
import { makeCopilotProviderHarness, probeCopilotModels } from "./copilotProvider.ts";
import { makeCursorProviderHarness, probeCursorModels } from "./cursorProvider.ts";
import { makeDevinHarness, probeDevinModels } from "./devinProvider.ts";
import { accountEnvironmentOf, claudeModels, type HarnessFacts, harnessFacts } from "./harnessCatalog.ts";
import type { SignInStatus } from "./harnessTools.ts";
import { makeMuseHarness } from "./muse.ts";
import { listMuseModels, readMuseSignIn } from "./museAccount.ts";
import { detectOpenCodeSandbox } from "./openCodeSandbox.ts";
import { listOpenCodeEfforts, makeOpenCodeHarness } from "./opencode.ts";
import { makePiHarness } from "./pi.ts";
import { probePiModels } from "./piRpc.ts";
import { makeVibeHarness } from "./vibe.ts";
import { listVibeModels, readVibeSignIn } from "./vibeAccount.ts";

// The harness registry (provider-accounts): each harness defined once, by its facts, its turn adapter, and
// what Outlore asks its own tool about sign-in and models. Adding a harness adds one entry here and one line in `makeHarnessRouter`.

/** What every harness's turn adapter is started with in the app. */
export type AdapterOptions = {
  /** The executable. */
  readonly command: string;
  /** The service's own folder, where a wrapped OpenCode keeps its state; the system's temporary folder when left out. */
  readonly dataDirectory?: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
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
  makeAdapter: ({ command, idleTimeout, sandboxProblem, vaultFolder }) =>
    makeClaudeHarness({ command, idleTimeout, sandboxProblem, ...(vaultFolder === undefined ? {} : { vaultFolder }) }),
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
  makeAdapter: ({ command, idleTimeout, vaultFolder }) =>
    makeCodexHarness({ command, idleTimeout, ...(vaultFolder === undefined ? {} : { vaultFolder }) }),
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
  makeAdapter: ({ command, dataDirectory, idleTimeout, sandboxProblem, vaultFolder }) =>
    makeOpenCodeHarness({
      command,
      idleTimeout,
      sandbox: detectOpenCodeSandbox({
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
  makeAdapter: ({ command, idleTimeout }) => makeVibeHarness({ command, idleTimeout }),
  readModels: (command, configDirectory) => listVibeModels(command, configDirectory),
  readSignIn: (command, env) => readVibeSignIn(command, env),
};

const hermes: HarnessDefinition = {
  ...harnessFacts.hermes,
  // Hermes runs through the generic ACP adapter: every permission request reaches the owner, modes are forced to
  // "ask" where the provider offers them, and the account folder becomes HERMES_HOME (acpProviders.ts).
  makeAdapter: ({ command, idleTimeout }) =>
    makeAcpProviderHarness({ command, idleTimeout, profile: acpProviderProfiles.hermes }),
  // Models come from the ACP probe against the account's own (prepared) home; the computer's own Hermes directory is
  // never probed, and a home that is not set up yet (no repair, no sign-in, no model) lists none yet.
  readModels: (command, configDirectory) =>
    configDirectory === null
      ? Effect.succeed([])
      : probeAcpProviderModels({ command, profile: acpProviderProfiles.hermes, stateHome: configDirectory }).pipe(
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
  makeAdapter: ({ command, idleTimeout }) =>
    makeMuseHarness({ command, env: { MUSE_NO_AUTO_UPDATE: "1" }, idleTimeout }),
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
  makeAdapter: ({ command, idleTimeout }) => makePiHarness({ command, idleTimeout, provider: "pi" }),
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

// The five ACP provider harnesses (CHG-0645, provider-parity wave 5): each runs one long-lived ACP process of the
// generic adapter, so every sensitive action reaches the owner as a permission request and any other reverse
// request fails closed. All five take the computer's own sign-in only (their added-account surfaces are absent or
// unproven - supportsAddedAccounts stays false), and each models probe catches failure as no models yet.

const antigravity: HarnessDefinition = {
  ...harnessFacts.antigravity,
  makeAdapter: ({ command, idleTimeout }) => makeAntigravityHarness({ command, idleTimeout }),
  // Models come from a short-lived session probe against the computer's own Gemini home; none when the CLI is
  // absent or not signed in.
  readModels: (command) =>
    probeAntigravityModels({ command }).pipe(
      Effect.map((models): ReadonlyArray<ModelOption> => models),
      Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([])),
    ),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const cline: HarnessDefinition = {
  ...harnessFacts.cline,
  makeAdapter: ({ command, idleTimeout }) => makeClineHarness({ command, idleTimeout }),
  readModels: (command) =>
    probeClineModels({ command }).pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([]))),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const copilot: HarnessDefinition = {
  ...harnessFacts.copilot,
  makeAdapter: ({ command, idleTimeout }) => makeCopilotProviderHarness({ command, idleTimeout }),
  // A signed-out Copilot answers with no models rather than failing, so the probe failing at all (the CLI absent)
  // reads as no models yet, exactly as upstream's signed-out shape does.
  readModels: (command) =>
    probeCopilotModels({ command }).pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([]))),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const cursor: HarnessDefinition = {
  ...harnessFacts.cursor,
  makeAdapter: ({ command, idleTimeout }) => makeCursorProviderHarness({ command, idleTimeout }),
  readModels: (command) =>
    probeCursorModels({ command }).pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([]))),
  readSignIn: () => Effect.succeed(unknownSignIn),
};

const devin: HarnessDefinition = {
  ...harnessFacts.devin,
  makeAdapter: ({ command, idleTimeout }) => makeDevinHarness({ command, idleTimeout }),
  // Devin lists models only when signed in, so both the signed-out probe and any probe failure read as none yet.
  readModels: (command) =>
    probeDevinModels({ command }).pipe(Effect.catch(() => Effect.succeed<ReadonlyArray<ModelOption>>([]))),
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

/** The adapter the app runs turns through: each harness's own, started from its definition (provider-accounts). */
export const makeHarnessRouter = (commands: Record<HarnessName, string>, options: Omit<AdapterOptions, "command">) => {
  const adapterOf = (name: HarnessName) => harnesses[name].makeAdapter({ ...options, command: commands[name] });
  return Effect.all({
    antigravity: adapterOf("antigravity"),
    claude: adapterOf("claude"),
    cline: adapterOf("cline"),
    codex: adapterOf("codex"),
    copilot: adapterOf("copilot"),
    cursor: adapterOf("cursor"),
    devin: adapterOf("devin"),
    hermes: adapterOf("hermes"),
    muse: adapterOf("muse"),
    opencode: adapterOf("opencode"),
    pi: adapterOf("pi"),
    vibe: adapterOf("vibe"),
  } satisfies Record<HarnessName, unknown>).pipe(Effect.map(routeHarnesses));
};
