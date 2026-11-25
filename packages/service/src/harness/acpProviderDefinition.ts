import { type AccountIsolation, isolationEnvOf } from "./accountIsolation.ts";

/**
 * The facts of one ACP provider that launching, probing models, signing in and inspecting the executable all need.
 * They are stated once here, per provider, because the sign-in and the launch once disagreed about where the CLI keeps its token (CHG-0676):
 * each read its own copy of the environment, so a sign-in that succeeded was never found by a launch.
 */
export type AcpProviderDefinition = {
  /** The arguments that start the provider's ACP server; `home` is the state home a `pinned` rule resolved, else null. */
  readonly argv: (home: string | null) => ReadonlyArray<string>;
  /** The default executable when no `OUTLORE_<HARNESS>_PATH` override is set. */
  readonly executable: string;
  /** Whether each spawned ACP process gets a fresh temporary directory as `TMPDIR`, `TMP`, and `TEMP`, removed when the process ends. */
  readonly hasIsolatedTempDir?: boolean;
  /** Whether an account's folder can isolate the provider, and which environment variables point it there; the catalog and the Workshop read the same value. */
  readonly isolation: AccountIsolation;
  /** The provider's name as the owner reads it. */
  readonly label: string;
  /** An older executable name preferred when it is already installed on `PATH`. */
  readonly legacyExecutable?: string;
  /** The state home the launch resolves once and carries in the argv and a variable, for the computer's own sign-in as well; absent when the provider needs none named. */
  readonly pinnedHome?: PinnedHome;
  /** Where the provider's agent departs from the protocol every ACP harness shares; absent when it does not. */
  readonly protocol?: AcpProviderProtocol;
  /** Ambient environment variable prefixes stripped from the child process before `spawnEnv`, the state home, and explicit overrides apply. */
  readonly scrubEnvPrefixes?: ReadonlyArray<string>;
  /** The provider's own sign-in command, or null when no sign-in command of its own is verified. */
  readonly signIn: AcpSignIn | null;
  /** The JSON-RPC error code a signed-out provider answers `session/new` with, or null when none is verified. */
  readonly signedOutCode: number | null;
  /** The non-secret environment every process of the provider carries: launch, model probe and sign-in alike. */
  readonly spawnEnv: Readonly<Record<string, string>>;
  /** The generation the provider was audited against, or null when no gate is verified. */
  readonly version: VersionGate | null;
};

/**
 * The facts of the protocol a provider's agent does differently, as data: acpHarness.ts holds what each one does.
 * Everything not named here is the same for every ACP agent.
 */
export type AcpProviderProtocol = {
  /** The minimum agent version (`initialize`'s `agentInfo.version`) required before opening a session; an agent reporting an older version fails startup. */
  readonly minimumAgentVersion?: string;
  /** Permission requests of tool calls whose id starts with this are questions for the owner to choose an answer to, not actions to approve. */
  readonly questionIdPrefix?: string;
  /** The agent replays a session's tool calls on `session/load`, so a session it advertises it can resume is resumed instead. */
  readonly resumesSessions?: boolean;
  /**
   * The agent version from which a message steered into a running turn is sent as a second `session/prompt`, which the agent reads as a message into the running prompt (acpHarness.ts, `AcpDialect.steersWithPromptFrom`).
   * Only an agent known to do so has it: standard ACP defines no message into a running prompt, and an agent that does not expect a second prompt may refuse it or queue it.
   */
  readonly steersWithPromptFrom?: string;
  /** The agent takes the starting context as its system prompt under `_meta.<namespace>.systemPrompt.append` when it advertises doing so, instead of in the first prompt. */
  readonly systemPromptNamespace?: string;
};

/** How the provider's own sign-in command runs; its environment is the spawn environment plus these extras. */
export type AcpSignIn = {
  /** The arguments of the sign-in command for one state home (see `AcpProviderDefinition.argv`). */
  readonly argv: (home: string | null) => ReadonlyArray<string>;
  /** Environment only the sign-in carries, such as the flag that keeps a link flow from opening a browser. */
  readonly extraEnv: Readonly<Record<string, string>>;
  /** Whether a terminal window the sign-in opens keeps this process's `PATH`, so the window finds the executable by its bare name. */
  readonly keepsPath?: boolean;
};

/**
 * A state home the argv binds, so a launch, a probe and a sign-in must all name the same one.
 * The account's folder is the home when the provider's isolation takes one, else `resolve` finds the computer's own.
 */
export type PinnedHome = {
  readonly resolve: (env: Readonly<Record<string, string | undefined>>) => string;
  /** The variable that carries the home beside the argv. */
  readonly variable: string;
};

/** What a binary's `--version` output must satisfy for Outlore to run it, and what the owner reads when it does not. */
export type VersionGate = {
  readonly accepts: (output: string) => boolean;
  /** The generation or shape the provider was audited against, in words ("generation 3 or newer"). */
  readonly expects: string;
};

/** A gate on the first number of the output: the major version of the generation the provider was audited against. */
export const majorVersionAtLeast = (minimum: number): VersionGate => ({
  accepts: (output) => {
    const match = /\d+/u.exec(output.trim());
    return match !== null && Number.parseInt(match[0], 10) >= minimum;
  },
  expects: `generation ${minimum} or newer`,
});

/** A gate on the shape of the whole line, for a provider whose version is a date and a build rather than a major number. */
export const versionLineMatching = (shape: RegExp, expects: string): VersionGate => ({
  accepts: (output) => shape.test(output.trim()),
  expects,
});

/** One resolution of a definition's launch: argv and environment in full for one account, plus the hygiene and protocol facts the adapter applies. */
export type AcpProviderLaunch = {
  readonly args: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string>>;
  /** Whether each spawned ACP process gets a fresh temporary directory as `TMPDIR`, `TMP`, and `TEMP`, removed when the process ends. */
  readonly hasIsolatedTempDir?: boolean;
  readonly label: string;
  /** The provider's departures from the shared protocol, carried from its definition. */
  readonly protocol?: AcpProviderProtocol;
  /** Ambient environment variable prefixes stripped from the child process before `env` applies. */
  readonly scrubEnvPrefixes?: ReadonlyArray<string>;
};

/** What one call resolves a definition against. */
export type AcpResolveOptions = {
  /** The account's folder, or null/absent for the computer's own sign-in; a provider no folder can isolate ignores it. */
  readonly configDirectory?: string | null;
  /** Extra environment for the process, such as a stand-in's knobs in checks. */
  readonly env?: Readonly<Record<string, string>>;
  /** The environment a pinned home resolves its default from; the process's own when absent. */
  readonly processEnv?: Readonly<Record<string, string | undefined>>;
};

/**
 * The home and the isolation environment of one account, the single place a launch, a probe and a sign-in all read.
 * A provider no folder can isolate never takes the account's folder, so a stale account cannot move it off the computer's sign-in.
 */
const isolationOf = (definition: AcpProviderDefinition, options: AcpResolveOptions) => {
  const accountDirectory = definition.isolation.kind === "directory" ? (options.configDirectory ?? null) : null;
  const pinned = definition.pinnedHome;
  const home = pinned === undefined ? null : (accountDirectory ?? pinned.resolve(options.processEnv ?? process.env));
  return {
    env: {
      ...(pinned === undefined || home === null ? {} : { [pinned.variable]: home }),
      ...isolationEnvOf(definition.isolation, accountDirectory),
    },
    home,
  };
};

/**
 * The launch of a definition for one account, read by the harness's turns, its model probe, its sign-in read and its plan limits alike.
 * Argv and environment are resolved per call, so the home in the argv and in the variables can never differ.
 */
export const acpLaunchOf = (definition: AcpProviderDefinition, options: AcpResolveOptions = {}): AcpProviderLaunch => {
  const isolation = isolationOf(definition, options);
  return {
    args: definition.argv(isolation.home),
    env: { ...definition.spawnEnv, ...isolation.env, ...options.env },
    ...(definition.hasIsolatedTempDir === true ? { hasIsolatedTempDir: true } : {}),
    label: definition.label,
    ...(definition.protocol === undefined ? {} : { protocol: definition.protocol }),
    ...(definition.scrubEnvPrefixes === undefined || definition.scrubEnvPrefixes.length === 0
      ? {}
      : { scrubEnvPrefixes: definition.scrubEnvPrefixes }),
  };
};

/** The provider's own sign-in command with the environment it runs with: the spawn environment plus the account's isolation plus its extras. */
export type AcpSignInCommand = {
  readonly args: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string>>;
  readonly keepsPath: boolean;
};

/**
 * The sign-in of a definition, or null when it has none.
 * Its environment is built from the same isolation as the launch, so a sign-in stores its token where the launch will look for it.
 */
export const acpSignInOf = (
  definition: AcpProviderDefinition,
  options: AcpResolveOptions = {},
): AcpSignInCommand | null => {
  if (definition.signIn === null) return null;
  const isolation = isolationOf(definition, options);
  return {
    args: definition.signIn.argv(isolation.home),
    env: { ...definition.spawnEnv, ...isolation.env, ...definition.signIn.extraEnv },
    keepsPath: definition.signIn.keepsPath === true,
  };
};
