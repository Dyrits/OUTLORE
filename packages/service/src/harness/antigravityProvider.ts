import { homedir } from "node:os";
import { join } from "node:path";
import { type Duration, Effect, type Scope } from "effect";
import type { HarnessAdapter } from "../core/index.ts";
import type { AcpProviderProfile } from "./acpProviderProfiles.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "./acpProviders.ts";

// Antigravity: Google's Antigravity CLI, the ACP surface that fronts Gemini models. Surveyed fixture-first against
// the pinned upstream OpenBot (b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0, 2026-11-22); live hands-on stays pending,
// since no antigravity CLI is installed on this host.
//
// Surveyed facts (upstream file:line):
// - Executable `antigravity` (with legacy names agy_acp_server.par/.exe, src/main/native-provider-runtime.ts:93);
//   `--version` prints one bare semver (src/backend/cli.ts:377-381 parseAntigravityVersion).
// - Install: GitHub releases of google-antigravity/antigravity-cli, tar.gz archives with SHA-256 checksums, pinned
//   1.5.4 Proprietary (native-runtime.lock.json, antigravity entries; staging in src/main/native-provider-runtime.ts:37-46).
// - Launch: ACP over stdio. argv ["acp", "--gemini-dir=<home>", "--app-data-dir=antigravity-acp"]
//   (src/backend/provider-drivers.ts:292-296) against the Gemini home. Every spawn carries
//   AGY_CLI_DISABLE_AUTO_UPDATE=true (src/backend/cli.ts:806 ANTIGRAVITY_UPDATE_ENV, applied to the version check too,
//   cli.ts:810 and native-provider-runtime.ts:92). Upstream also sets WSL_DISTRO_NAME "OpenBot"
//   (src/backend/provider-drivers.ts:284); Outlore does not. Any WSL_DISTRO_NAME makes the CLI keep its tokens in a
//   file instead of the system keychain, and `agy acp --login` writes the keychain. With the variable set, a launch
//   found no sign-in after a successful login (CLI 1.5.16, live check 2026-11-24).
// - Isolation: the upstream accounts entry pins per-account state with homeVariable GEMINI_HOME
//   (src/backend/provider-drivers.ts:892), for CLI versions that take state folders (>= 1.5.3, src/backend/cli.ts:694-696
//   antigravityTakesStateFolders); the home is GEMINI_HOME, default ~/.gemini
//   (src/backend/acp-flavor-antigravity.ts:152-154), and its state sits under <home>/antigravity-acp
//   (src/backend/process-confinement.ts:80-82). Outlore holds the added-account step back: see
//   `antigravityAddedAccountsEvidence` below.
// - Mediation: Antigravity is a plain ACP server, so every sensitive action reaches the host as
//   session/request_permission and the default answer upstream gives is a refusal
//   (src/backend/acp-client.ts:4204-4278); its subagents ride the start/invoke_subagent TOOL calls
//   (ANTIGRAVITY_ACP_FLAVOR selfWakeTools, src/backend/acp-flavor-antigravity.ts), which Outlore mediates per call -
//   no native-unmediated subagent escape is in evidence, unlike Grok. Upstream also disables two of its own tools in
//   session/new via sessionMeta.antigravity.disabledTools ["schedule", "run_workflow"], proving the session can name
//   tools it wants off; Outlore needs no such list while every ask reaches the owner.
// - Sign-in: the ACP authenticate method "oauth-personal" walks a Google account flow
//   (src/backend/provider-drivers.ts:316-322); Outlore adopts none of upstream's stored-key paths (importAntigravityToken,
//   apiKey("antigravity") - src/backend/provider-drivers.ts:229-246): credentials stay in the CLI's own channels.
// - Models: the session carries them (ANTIGRAVITY_ACP_FLAVOR modelsLoadWithSession), so the generic ACP probe's
//   session/new reading covers this harness; upstream reports usage from its own token file (antigravity-usage.ts),
//   a registration-level concern this adapter does not read.

/** The app-data directory the CLI nests inside the Gemini home (upstream ANTIGRAVITY_APP_DATA, provider-drivers.ts:286). */
export const antigravityAppData = "antigravity-acp";

/**
 * The Gemini home a launch runs against: the account's GEMINI_HOME, else ~/.gemini, exactly the way upstream resolves it
 * (src/backend/acp-flavor-antigravity.ts:152-154).
 */
export const antigravityGeminiHome = (
  env: Readonly<Record<string, string | undefined>>,
  home: string = homedir(),
): string => env.GEMINI_HOME?.trim() || join(home, ".gemini");

/**
 * The pinned launch arguments for one Gemini home (src/backend/provider-drivers.ts:292-296): the ACP subcommand, then
 * the home in the --gemini-dir flag, then Antigravity's own app-data directory inside it.
 */
export const antigravityArgsOf = (home: string): ReadonlyArray<string> => [
  "acp",
  `--gemini-dir=${home}`,
  `--app-data-dir=${antigravityAppData}`,
];

/**
 * Whether the CLI generation takes per-account state folders (>= 1.5.3), the upstream gate on added accounts
 * (src/backend/cli.ts:694-696 antigravityTakesStateFolders); a registration reads this before offering an account home.
 */
export const antigravityTakesStateFolders = (version: string): boolean => {
  const [major = 0, minor = 0, patch = 0] = version.split(".").map(Number);
  return major > 1 || (major === 1 && (minor > 5 || (minor === 5 && patch >= 3)));
};

/**
 * Why added accounts stay blocked until a live CLI check, even though upstream pins them with GEMINI_HOME: upstream
 * passes an account's GEMINI_HOME into BOTH the environment and the --gemini-dir flag (src/backend/provider-drivers.ts:892
 * with antigravityArgv({...process.env, ...context.accountEnvironment}), :292-296), so its two home channels always agree,
 * but the pinned tree does not show which one the CLI follows when they differ. Outlore's generic adapter pins an added
 * account through the environment alone while the flag names the launch-time home, so until a live check proves the
 * hierarchy - or the adapter grows an account-aware flag - an Antigravity harness takes the computer's own sign-in only,
 * the Muse precedent (supportsAddedAccounts false).
 */
export const antigravityAddedAccountsEvidence =
  "Antigravity added accounts are blocked: upstream pins an account's home with GEMINI_HOME in the environment and the " +
  "same value in its --gemini-dir flag (nightly-labs/openbot b1e5ea7, src/backend/provider-drivers.ts:292-296 and :892), " +
  "so the pinned tree never shows the CLI resolving two homes that disagree. Outlore's adapter would have to pin an " +
  "added account by environment alone while the flag keeps the launch home, an unverified split, so registration admits " +
  "only the computer's own sign-in until a live CLI check proves which channel wins.";

/**
 * The audited launch profile against one Gemini home, with the pinned environment: the account home, the auto-update
 * suppression upstream sets at every spawn. Unlike upstream it sets no WSL_DISTRO_NAME, so the launch reads the sign-in
 * that `agy acp --login` stored in the keychain. The minimum generation keeps 1.x; added accounts are gated separately above.
 */
export const antigravityProfileOf = (home: string, env: Record<string, string> = {}): AcpProviderProfile => ({
  args: antigravityArgsOf(home),
  env: {
    AGY_CLI_DISABLE_AUTO_UPDATE: "true",
    GEMINI_HOME: home,
    ...env,
  },
  label: "Gemini (Antigravity)",
  minMajorVersion: 1,
});

/** How an Antigravity probe (and nothing else) starts. */
export type AntigravityProbeOptions = {
  /** The antigravity executable. */
  readonly command: string;
  /** Extra environment for the launch, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
  /** The Gemini home to launch against; the process's GEMINI_HOME, else its ~/.gemini, when absent. */
  readonly geminiHome?: string;
  /** Arguments placed before the profile's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/** Lists the models of an Antigravity session against the given home, without prompting or exposing any MCP server. */
export const probeAntigravityModels = Effect.fnUntraced(function* (options: AntigravityProbeOptions) {
  const home = options.geminiHome ?? (yield* Effect.sync(() => antigravityGeminiHome(process.env)));
  return yield* probeAcpProviderModels({
    command: options.command,
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: antigravityProfileOf(home, options.env ?? {}),
  });
});

/** How the Antigravity harness starts. */
export type AntigravityOptions = {
  /** The antigravity executable. */
  readonly command: string;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
  /** The Gemini home to run against; the process's GEMINI_HOME, else its ~/.gemini, when absent. */
  readonly geminiHome?: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** The MCP servers the session is given; none by default, so the thread's own tool server stays unexposed. */
  readonly mcpServers?: ReadonlyArray<object>;
  /** Arguments placed before the profile's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/**
 * Runs each thread in one long-lived Antigravity ACP process: every permission request reaches the owner, the mode
 * stays "ask" where the session offers one, and the launch always carries the same home in its flag and environment.
 */
export const makeAntigravityHarness = (
  options: AntigravityOptions,
): Effect.Effect<HarnessAdapter, never, Scope.Scope> =>
  Effect.suspend(() =>
    makeAcpProviderHarness({
      command: options.command,
      idleTimeout: options.idleTimeout,
      ...(options.mcpServers === undefined ? {} : { mcpServers: options.mcpServers }),
      ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
      profile: antigravityProfileOf(options.geminiHome ?? antigravityGeminiHome(process.env), options.env ?? {}),
    }),
  );
