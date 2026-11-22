import { type Duration, Effect, type Scope } from "effect";
import type { HarnessAdapter } from "../core/index.ts";
import type { AcpProviderProfile } from "./acpProviderProfiles.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "./acpProviders.ts";

// Devin: Cognition's Devin CLI, its own ACP surface. Surveyed fixture-first against the pinned upstream OpenBot
// (b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0, 2026-11-22); live hands-on stays pending, since no devin CLI is installed
// on this host.
//
// Surveyed facts (upstream file:line):
// - Executable `devin`; `--version` prints "devin v#.#.#" and the parser takes that version (src/backend/cli.ts:775-783
//   parseDevinVersion, resolveNativeCli at :751-753).
// - Install: Cognition's own manifest at https://static.devin.ai/cli/current/manifest.json, per-platform tar.gz archives
//   with SHA-256 checksums pinned to 3000.14.30821, Proprietary (native-runtime.lock.json, devin entries; the release
//   probe validates the manifest's checksum and exact artifact URL, src/main/provider-runtime-releases.ts:159-190).
// - Launch: ACP over stdio with argv ["acp"] (DEVIN_ARGV, src/backend/provider-drivers.ts:393) and no extra environment.
// - Isolation: upstream has NO accounts entry for devin - no home variable, no added accounts (the driver block at
//   src/backend/provider-drivers.ts:1136-1172) - and its state lives under the machine-wide XDG data root
//   (src/backend/process-confinement.ts:304-305: XDG_DATA_HOME, else ~/.local/share, plus "/devin"), so a Devin
//   harness takes the computer's own sign-in only, the Muse precedent (supportsAddedAccounts false); XDG_DATA_HOME itself
//   cannot serve as a scoped account home. Its credentials.toml is written by the CLI's own sign-in
//   (signInFiles, src/backend/provider-drivers.ts:1138).
// - Mediation: Devin is a plain ACP server, so every sensitive action reaches the host as session/request_permission,
//   and the default answer upstream gives is a refusal (src/backend/acp-client.ts:4204-4278). Its ACP flavor only
//   recognizes a -32016 session_not_found error, steering by prompt through the cognition.ai/midTurnPrompts capability,
//   and run ids in the prompt's _meta (src/backend/acp-flavor.ts:418-426) - conversation refinements the generic
//   adapter needs none of to mediate a turn.
// - Sign-in: the ACP authenticate method "devin-browser" walking Cognition's app.devin.ai page
//   (src/backend/provider-drivers.ts:1137; src/backend/acp-sign-in.ts:116 and :263-288); sign-out runs
//   `devin auth logout` (:1139). Outlore passes nothing and stores nothing.
// - Models: only a signed-in session lists its models (noModelsWhenSignedOut, src/backend/provider-drivers.ts:1155 and
//   :1168), so a probe of an unsigned CLI answers with none rather than failing. Upstream reports no usage for devin
//   (agent-providers.ts:298 reportsUsage false).
// - Update: no update command of Devin's own and no self-update suppression environment appear anywhere in the pinned
//   tree, so there is nothing to carry: the environment stays empty, and no upstream updater is ever run by Outlore.

/** The audited launch profile: the pinned argv and environment. */
export const devinProfile: AcpProviderProfile = {
  args: ["acp"],
  env: {},
  label: "Devin",
};

/** How a Devin probe (and nothing else) starts. */
export type DevinProbeOptions = {
  /** The devin executable. */
  readonly command: string;
  /** Extra environment for the launch, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
  /** Arguments placed before the profile's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/** Lists the models of a signed-in Devin session without prompting or exposing any MCP server. */
export const probeDevinModels = Effect.fnUntraced(function* (options: DevinProbeOptions) {
  return yield* probeAcpProviderModels({
    command: options.command,
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: { ...devinProfile, env: { ...devinProfile.env, ...(options.env ?? {}) } },
  });
});

/** How the Devin harness starts. */
export type DevinOptions = {
  /** The devin executable. */
  readonly command: string;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** The MCP servers the session is given; none by default, so the thread's own tool server stays unexposed. */
  readonly mcpServers?: ReadonlyArray<object>;
  /** Arguments placed before the profile's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/**
 * Runs each thread in one long-lived Devin ACP process: every permission request reaches the owner, the mode stays
 * "ask" where the session offers one, and a provider that only lists models when signed in simply runs without.
 */
export const makeDevinHarness = (options: DevinOptions): Effect.Effect<HarnessAdapter, never, Scope.Scope> =>
  makeAcpProviderHarness({
    command: options.command,
    idleTimeout: options.idleTimeout,
    ...(options.mcpServers === undefined ? {} : { mcpServers: options.mcpServers }),
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: { ...devinProfile, env: { ...devinProfile.env, ...(options.env ?? {}) } },
  });
