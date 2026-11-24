import { type AcpProviderDefinition, versionLineMatching } from "./acpProviderDefinition.ts";

// Cursor through the Cursor CLI's own ACP surface, audited against the pinned upstream nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0.
// The generic ACP adapter (acpProviders.ts) runs it: every sensitive action comes as `session/request_permission`, each one is answered by asking the owner, and any other reverse request is refused (fail closed).
// Each fact below names its source file:line so a later reader can recheck it.
//
// Surveyed facts (upstream file:line):
// - Executable: `cursor-agent`, never `cursor`, which starts the editor (resolveCursorCli maps the provider to `cursor-agent`; src/backend/cli.ts `cliCommandName` and docs/architecture/providers.md:1079-1081).
// - Launch: `acp` (src/backend/provider-drivers.ts:979), with no environment and no self-update switch.
// - Version: `cursor-agent --version` answers a date, an optional build time and a commit hash, such as the locked 2026.09.28-64d2043 (parseCursorVersion, src/backend/cli.ts:458-465).
//   OpenBot's key-account date gate (2026.10.01) is not an execution-generation gate and does not apply, because key accounts are not offered here.
// - Sign-in: a link flow that prints its URL (codeSignIn, src/backend/provider-drivers.ts:966-969), with `NO_OPEN_BROWSER` set so it never opens a page on its own.
//   Upstream also offers an ACP `authenticate` method (`cursor_login`, provider-drivers.ts:963) whose live surface is unproven, so readSignIn stays Unknown until the owner verifies one real sign-in.
//   Its terminal sign-out is `logout` (provider-drivers.ts:971); Outlore does not run it.
// - Update: no update command of Cursor's own exists upstream, because its runtime updates ride OpenBot's own ACP-registry installer, so Update explains instead of running anything.
// - Isolation: Cursor keeps one sign-in per computer user, in the login Keychain on macOS (`cursor-access-token`, account `cursor-user`) and in `auth.json` under fixed per-platform paths elsewhere.
//   `CURSOR_CONFIG_DIR` moves only its settings, never the sign-in, so no added-account home exists and only the computer's own sign-in is offered.
// - Added accounts: upstream's second account is a Cursor API key stored encrypted by the host and passed through the environment (src/backend/provider-drivers.ts:972-974, docs/architecture/providers.md:1091-1101).
//   Outlore never reads, stores or relays credentials (documentation/research/openbot-integration-parity-2026-11-22.md), so no key account is offered.
//   A CLI before 2026.10.01 ignores the memory-store variable altogether, so nothing about a key account is stable for the machine's user either.
// - Usage: the CLI reports none over ACP (docs/architecture/providers.md:1106).
//   Upstream reads it by taking the CLI's access token from the Keychain or auth.json and calling the undocumented api2.cursor.sh DashboardService (src/backend/cursor-usage.ts:9-24), a credential-reading surface Outlore does not adopt.

/** The audited provider: computer sign-in only, so no state home to redirect and no per-account environment. */
export const cursor: AcpProviderDefinition = {
  argv: () => ["acp"],
  executable: "cursor-agent",
  label: "Cursor",
  signedOutCode: null,
  signIn: { argv: () => ["login"], extraEnv: { NO_OPEN_BROWSER: "1" } },
  spawnEnv: {},
  stateHome: { kind: "computer", variable: "CURSOR_CONFIG_DIR" },
  version: versionLineMatching(
    /^\d{4}\.\d{2}\.\d{2}(?:-\d{2}-\d{2}-\d{2})?-[0-9a-f]{7,40}$/u,
    "a dated build such as 2026.09.28-64d2043",
  ),
};
