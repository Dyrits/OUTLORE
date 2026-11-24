import { homedir } from "node:os";
import { join } from "node:path";
import { type AcpProviderDefinition, majorVersionAtLeast } from "./acpProviderDefinition.ts";

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
//   (src/backend/process-confinement.ts:80-82). Outlore holds the added-account step back: see "Added accounts" below.
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
// - Added accounts: upstream passes an account's GEMINI_HOME into BOTH the environment and the --gemini-dir flag (provider-drivers.ts:892 with antigravityArgv({...process.env, ...context.accountEnvironment}), :292-296), so its two home channels always agree.
//   The pinned tree does not show which one the CLI follows when they differ, and the state-home rule below pins one home into both, so an Antigravity harness takes the computer's own sign-in only until a live check proves the hierarchy.
//   Upstream gates state folders on CLI >= 1.5.3 (antigravityTakesStateFolders, src/backend/cli.ts:694-696); Outlore reads no such gate while added accounts stay refused.

/** The app-data directory the CLI nests inside the Gemini home (upstream ANTIGRAVITY_APP_DATA, provider-drivers.ts:286). */
const appData = "antigravity-acp";

/**
 * The Gemini home a launch runs against: GEMINI_HOME, else ~/.gemini, exactly the way upstream resolves it
 * (src/backend/acp-flavor-antigravity.ts:152-154).
 */
export const antigravityGeminiHome = (
  env: Readonly<Record<string, string | undefined>>,
  home: string = homedir(),
): string => env.GEMINI_HOME?.trim() || join(home, ".gemini");

/**
 * The pinned launch arguments for one Gemini home (src/backend/provider-drivers.ts:292-296): the ACP subcommand, then the home in the --gemini-dir flag, then Antigravity's own app-data directory inside it.
 */
const argvOf = (home: string | null): ReadonlyArray<string> => [
  "acp",
  `--gemini-dir=${home ?? antigravityGeminiHome(process.env)}`,
  `--app-data-dir=${appData}`,
];

/**
 * The audited provider.
 * The home rides in the flag and in GEMINI_HOME from one resolution, so the launch, the model probe and the sign-in always agree on it.
 * Unlike upstream it sets no WSL_DISTRO_NAME: any value makes the CLI keep its tokens in a file instead of the keychain, where `agy acp --login` stores them (CHG-0676).
 */
export const antigravity: AcpProviderDefinition = {
  argv: argvOf,
  executable: "agy",
  label: "Gemini (Antigravity)",
  legacyExecutable: "antigravity",
  // agy 1.5.16 advertises `sessionCapabilities.resume` (live check 2026-11-24), and loading a session replays its tool calls.
  // Its `interaction_*` permission requests carry the agent's questions for the user (T3 Code, AntigravityProtocol.ts:72-77),
  // so they are choices for the owner, never approvals.
  protocol: { questionIdPrefix: "interaction_", resumesSessions: true },
  // A signed-out Antigravity answers `session/new` with -32000 "Authentication required" (CLI 1.5.16, live check 2026-11-24).
  signedOutCode: -32000,
  // The sign-in is the launch's own argv with --login, so it can only open the home the launch will read.
  signIn: { argv: (home) => [...argvOf(home), "--login"], extraEnv: {}, keepsPath: true },
  spawnEnv: { AGY_CLI_DISABLE_AUTO_UPDATE: "true" },
  stateHome: { kind: "pinned", resolve: (env) => antigravityGeminiHome(env), variable: "GEMINI_HOME" },
  version: majorVersionAtLeast(1),
};
