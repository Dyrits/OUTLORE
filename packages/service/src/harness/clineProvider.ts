import { computerOnlyIsolation } from "./accountIsolation.ts";
import { type AcpProviderDefinition, majorVersionAtLeast } from "./acpProviderDefinition.ts";

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
//   the Muse precedent (a `computerOnly` isolation). CLINE_DIR/CLINE_DATA_DIR exist only as process-confinement paths
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

/** The audited provider: the pinned argv and environment, gated on generation 3 (the minimum upstream enforces). */
export const cline: AcpProviderDefinition = {
  argv: () => ["--acp"],
  executable: "cline",
  // Only the computer's own sign-in: no verified account surface exists, so no launch redirects CLINE_DATA_DIR.
  isolation: computerOnlyIsolation(
    "Upstream has no accounts entry for Cline, and CLINE_DIR and CLINE_DATA_DIR only steer its process confinement.",
  ),
  label: "Cline",
  signedOutCode: null,
  // The CLI's device-flow sign-in, with the same environment every spawn carries upstream; a live check verifies the code it prints in the terminal.
  signIn: { argv: () => ["auth", "-p", "cline"], extraEnv: {} },
  spawnEnv: { CLINE_NO_AUTO_UPDATE: "1", CLINE_SESSION_BACKEND_MODE: "local" },
  version: majorVersionAtLeast(3),
};
