import { type Duration, Effect, type Scope } from "effect";
import type { HarnessAdapter } from "../core/index.ts";
import type { AcpProviderProfile } from "./acpProviderProfiles.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "./acpProviders.ts";

// Cline: the Cline CLI's own ACP surface. Surveyed fixture-first against the pinned upstream OpenBot
// (b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0, 2026-11-22); live hands-on stays pending, since no cline CLI is installed
// on this host.
//
// Surveyed facts (upstream file:line):
// - Executable `cline`; upstream requires at least 3.0.68 (src/backend/cli.ts:19 MINIMUM_CLINE_VERSION, enforced at
//   resolveClineCli, :487-523), so the profile gates on generation 3.
// - Install: the npm registry's platform packages @cline/cli-<target> (repository github.com/cline/cline), pinned
//   3.0.68 Apache-2.0 with license and binary SHA-256s (native-runtime.lock.json, cline entries; the release probe
//   reads npm "latest", src/main/provider-runtime-releases.ts:332-343).
// - Launch: ACP over stdio with argv ["--acp"] (CLINE_ARGV, src/backend/provider-drivers.ts:324) and environment
//   CLINE_SESSION_BACKEND_MODE=local plus CLINE_NO_AUTO_UPDATE=1 (src/backend/provider-drivers.ts:326-330), carried at
//   every spawn upstream makes: the turn client, its profile client, and the device sign-in (:1020-1036).
// - isolation: upstream has NO accounts entry for cline (no home variable, no added accounts; the driver block sits
//   between "cursor" and "kimi" without an `accounts` key), so a Cline harness takes the computer's own sign-in only -
//   the Muse precedent (supportsAddedAccounts false). CLINE_DIR/CLINE_DATA_DIR exist only as process-confinement paths
//   (src/backend/process-confinement.ts:149-166), not as an account surface upstream proved.
// - Mediation: Cline is a plain ACP server, so every sensitive action reaches the host as session/request_permission,
//   and the default answer upstream gives is a refusal (src/backend/acp-client.ts:4204-4278). Its subagents ride the
//   spawn_agent TOOL call (CLINE_ACP_FLAVOR subagentTools ["spawn_agent"], src/backend/acp-flavor.ts:178-181; upstream
//   only folds it into its display, src/backend/acp-client.ts:3888-3892), which Outlore mediates per call - no
//   native-unmediated subagent escape is in evidence, unlike Grok.
// - Sign-in: the ACP authenticate method "cline" (src/backend/provider-drivers.ts:1020-1024) and a device-flow command
//   `cline auth -p cline` with the same environment (:1027-1029); upstream's message also names a CLINE_API_KEY
//   environment key (packages/contracts/src/agent-providers.ts:237) - Outlore stores none of it and passes no key.
// - Models: the session's configOptions plus Cline's own free-model list upstream splices in (src/backend/
//   provider-drivers.ts:1039 additionalModels clineFreeModels(), :1051); the ids are encoded (encodesModelIds, :1040),
//   so they stay opaque strings here. Upstream reports no usage for cline (agent-providers.ts:251 reportsUsage false).
// - Update: no update command of Cline's own is in the pinned tree; the CLI's self-update is suppressed with
//   CLINE_NO_AUTO_UPDATE=1, this profile's pinned environment.

/**
 * The audited launch profile: the pinned argv and environment, gated on generation 3 (the minimum upstream enforces).
 */
export const clineProfile: AcpProviderProfile = {
  args: ["--acp"],
  env: { CLINE_NO_AUTO_UPDATE: "1", CLINE_SESSION_BACKEND_MODE: "local" },
  label: "Cline",
  minMajorVersion: 3,
};

/** How a Cline probe (and nothing else) starts. */
export type ClineProbeOptions = {
  /** The cline executable. */
  readonly command: string;
  /** Extra environment for the launch, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
  /** Arguments placed before the profile's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
};

/** Lists the models of a Cline session without prompting or exposing any MCP server. */
export const probeClineModels = Effect.fnUntraced(function* (options: ClineProbeOptions) {
  return yield* probeAcpProviderModels({
    command: options.command,
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: { ...clineProfile, env: { ...clineProfile.env, ...(options.env ?? {}) } },
  });
});

/** How the Cline harness starts. */
export type ClineOptions = {
  /** The cline executable. */
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
 * Runs each thread in one long-lived Cline ACP process: every permission request reaches the owner, the mode stays
 * "ask" where the session offers one, and the pinned environment suppresses the CLI's self-update on every spawn.
 */
export const makeClineHarness = (options: ClineOptions): Effect.Effect<HarnessAdapter, never, Scope.Scope> =>
  makeAcpProviderHarness({
    command: options.command,
    idleTimeout: options.idleTimeout,
    ...(options.mcpServers === undefined ? {} : { mcpServers: options.mcpServers }),
    ...(options.prefixArgs === undefined ? {} : { prefixArgs: options.prefixArgs }),
    profile: { ...clineProfile, env: { ...clineProfile.env, ...(options.env ?? {}) } },
  });
