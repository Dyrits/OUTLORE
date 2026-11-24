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
  /** The provider's name as the owner reads it. */
  readonly label: string;
  /** An older executable name preferred when it is already installed on `PATH`. */
  readonly legacyExecutable?: string;
  /** The provider's own sign-in command, or null when no sign-in command of its own is verified. */
  readonly signIn: AcpSignIn | null;
  /** The JSON-RPC error code a signed-out provider answers `session/new` with, or null when none is verified. */
  readonly signedOutCode: number | null;
  /** The non-secret environment every process of the provider carries: launch, model probe and sign-in alike. */
  readonly spawnEnv: Readonly<Record<string, string>>;
  /** Where the provider keeps its state and whether an account folder may redirect it. */
  readonly stateHome: StateHomeRule;
  /** The generation the provider was audited against, or null when no gate is verified. */
  readonly version: VersionGate | null;
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
 * Where a provider keeps its state, which is also what an account folder may redirect.
 * - `account`: the thread's account folder becomes the variable, so sign-in, sessions and MCP inheritance stay with the account.
 *   `needsConfiguredHome` means an empty folder cannot serve: it must be repaired, signed in and given a default model first.
 * - `pinned`: the launch always resolves one home (the account folder, else `resolve`) and carries it in the argv and the variable.
 * - `computer`: only the computer's own sign-in is offered, so nothing redirects; the variable is the provider's, recorded for the catalog.
 */
export type StateHomeRule =
  | { readonly kind: "account"; readonly needsConfiguredHome: boolean; readonly variable: string }
  | {
      readonly kind: "pinned";
      readonly resolve: (env: Readonly<Record<string, string | undefined>>) => string;
      readonly variable: string;
    }
  | { readonly kind: "computer"; readonly variable: string };

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

/** The ACP launch Outlore's generic adapter starts: argv and environment in full, plus the state-home rule the adapter applies per thread. */
export type AcpProviderProfile = {
  readonly args: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string>>;
  readonly label: string;
  /**
   * Environment variable the executable honors for its state home. Setting it isolates the
   * account's sign-in, config, and MCP inheritance from the user's own provider directory.
   */
  readonly stateHomeEnv?: string;
  /**
   * The state home cannot simply be created empty: it must be configured (repaired, signed in, a default
   * model) before the provider serves anything, so the probe needs a caller-supplied home (`stateHome`)
   * and a turn needs its account folder; an empty temp redirect would only mislead.
   */
  readonly needsConfiguredStateHome?: boolean;
};

/** What one call resolves a definition against. */
export type AcpResolveOptions = {
  /** The account's folder, or null/absent for the computer's own sign-in. */
  readonly configDirectory?: string | null;
  /** Extra environment for the process, such as a stand-in's knobs in checks. */
  readonly env?: Readonly<Record<string, string>>;
  /** The environment a `pinned` rule resolves its default home from; the process's own when absent. */
  readonly processEnv?: Readonly<Record<string, string | undefined>>;
};

/** The state home a `pinned` rule launches against: the account's folder, else the rule's own resolution; null for any other rule. */
const pinnedHomeOf = (definition: AcpProviderDefinition, options: AcpResolveOptions): string | null =>
  definition.stateHome.kind === "pinned"
    ? (options.configDirectory ?? definition.stateHome.resolve(options.processEnv ?? process.env))
    : null;

/**
 * The variable the state home sets in a process's environment: the pinned home, or an account folder under an `account` rule.
 * A launch leaves the account folder to the adapter, which sets it per thread; a sign-in has no adapter, so it sets it itself.
 */
const homeEnvOf = (
  definition: AcpProviderDefinition,
  options: AcpResolveOptions,
  home: string | null,
  appliesAccountFolder: boolean,
): Record<string, string> => {
  const rule = definition.stateHome;
  if (rule.kind === "pinned" && home !== null) return { [rule.variable]: home };
  if (rule.kind === "account" && appliesAccountFolder && options.configDirectory != null)
    return { [rule.variable]: options.configDirectory };
  return {};
};

/**
 * The launch of a definition, read by the harness's turns and its model probe alike.
 * An `account` rule is left to the adapter, which sets its variable per thread from the thread's account folder;
 * a `pinned` rule is resolved here, so the home in the argv and in the variable can never differ.
 */
export const acpLaunchOf = (definition: AcpProviderDefinition, options: AcpResolveOptions = {}): AcpProviderProfile => {
  const home = pinnedHomeOf(definition, options);
  const rule = definition.stateHome;
  return {
    args: definition.argv(home),
    env: { ...definition.spawnEnv, ...homeEnvOf(definition, options, home, false), ...options.env },
    label: definition.label,
    ...(rule.kind === "account"
      ? { ...(rule.needsConfiguredHome ? { needsConfiguredStateHome: true } : {}), stateHomeEnv: rule.variable }
      : {}),
  };
};

/** The provider's own sign-in command with the environment it runs with: the spawn environment plus the state home plus its extras. */
export type AcpSignInCommand = {
  readonly args: ReadonlyArray<string>;
  readonly env: Readonly<Record<string, string>>;
  readonly keepsPath: boolean;
};

/**
 * The sign-in of a definition, or null when it has none.
 * Its environment is built from the spawn environment, so a sign-in stores its token where the launch will look for it.
 */
export const acpSignInOf = (
  definition: AcpProviderDefinition,
  options: AcpResolveOptions = {},
): AcpSignInCommand | null => {
  if (definition.signIn === null) return null;
  const home = pinnedHomeOf(definition, options);
  return {
    args: definition.signIn.argv(home),
    env: { ...definition.spawnEnv, ...homeEnvOf(definition, options, home, true), ...definition.signIn.extraEnv },
    keepsPath: definition.signIn.keepsPath === true,
  };
};
