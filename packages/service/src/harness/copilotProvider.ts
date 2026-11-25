import { computerOnlyIsolation } from "./accountIsolation.ts";
import type { AcpProviderDefinition } from "./acpProviderDefinition.ts";

// GitHub Copilot through the Copilot CLI's own ACP surface, audited against the pinned upstream nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0.
// The generic ACP adapter (acpProviders.ts) runs it: every sensitive action comes as `session/request_permission`, each one is answered by asking the owner, and any other reverse request is refused (fail closed).
// Each fact below names its source file:line so a later reader can recheck it.
//
// Surveyed facts (upstream file:line):
// - Executable: `copilot` on the PATH, under that exact name; the runtime unpacks its JavaScript into its own cache on first run.
// - Launch: `--acp` for the protocol and `--no-auto-update`, because the CLI would otherwise run its newest cached package (COPILOT_ARGV, src/backend/provider-drivers.ts:395; docs/architecture/providers.md:1215-1219).
//   Every Copilot process also gets `COPILOT_AUTO_UPDATE=false` (COPILOT_ENV, src/backend/cli.ts:804), harness and probes alike, the Muse precedent.
// - Version: `copilot --version` answers "Copilot CLI vX.Y.Z" first and any bare semver second (parseCopilotVersion, src/backend/cli.ts:788-797); the locked generation is 1.0.105.
// - Sign-in: `copilot login` (src/backend/provider-drivers.ts:1179-1183) opens GitHub's page in the system browser and takes the result on a 127.0.0.1 callback.
//   Its `--device-code` variant prints a page and a code (provider-drivers.ts:1184-1191) for a joined host; Outlore does not run it.
//   The update squeeze goes through the environment, because `copilot login` refuses `--no-auto-update` (docs/architecture/providers.md:1215).
// - Sign-out: the CLI has no sign-out command; upstream starts the ACP server and calls its `logout` method (provider-drivers.ts:1192, docs/architecture/providers.md:1228-1229), which Outlore does not.
// - Update: no update command of Copilot's own exists upstream, so Update explains instead of running anything.
// - Signed-out shape: a signed-out Copilot answers `session/new` with -32000 (docs/architecture/providers.md:1230).
//   Outlore reads sign-in as Unknown and lists no models, so the code is not pinned here until a live check proves the sign-in read.
// - Isolation: the sign-in lives in the system keychain and the CLI's driver offers no added-account support, no key accounts and no home variable (src/backend/provider-drivers.ts:1176-1230), so only the computer's own sign-in is offered.
//   The CLI prefers COPILOT_GITHUB_TOKEN, GH_TOKEN and GITHUB_TOKEN over its keychain sign-in (docs/architecture/providers.md:1226-1227); Outlore never sets them.

/** The audited provider: computer sign-in only, so no state home to redirect. */
export const copilot: AcpProviderDefinition = {
  argv: () => ["--acp", "--no-auto-update"],
  executable: "copilot",
  isolation: computerOnlyIsolation(
    "Its sign-in sits in the system keychain and the upstream driver keeps no accounts entry for it.",
  ),
  label: "GitHub Copilot",
  signedOutCode: null,
  // The sign-in carries the spawn environment alone, which already squeezes the self-update off.
  signIn: { argv: () => ["login"], extraEnv: {} },
  spawnEnv: { COPILOT_AUTO_UPDATE: "false" },
  version: {
    accepts: (output) =>
      /\bCopilot CLI[ \t]+v?(\d+\.\d+\.\d+)\b/iu.test(output) || /\b\d+\.\d+\.\d+\b/u.test(output.trim()),
    expects: 'a version such as "Copilot CLI v1.0.105"',
  },
};
