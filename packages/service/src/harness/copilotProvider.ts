import { type Duration, Effect } from "effect";
import { type AcpProviderProfile, acpProviderProfiles } from "./acpProviderProfiles.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "./acpProviders.ts";

// GitHub Copilot through the Copilot CLI's own ACP surface, its fourth-wave entry audited against the pinned
// upstream nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0. This file pins the registration
// facts the survey verified (executable, launch, sign-in, update, isolation, signed-out shape) and hands
// registration the same generic ACP adapter Hermes rides (acpProviders.ts): every sensitive action comes as
// `session/request_permission`, each one is answered by asking the owner, and any other reverse request is
// refused (fail closed). The evidence strings name their source file:line so a later reader can recheck.
// Nothing here registers Copilot; registration stays the seam owner's (CHG-0641).

/**
 * The Copilot CLI's executable, `copilot` on the PATH (upstream resolves it under that exact name; the
 * runtime unpacks its JavaScript into its own cache on first run). A path override selects a `copilot`
 * binary, never a wrapper.
 */
export const copilotExecutable = "copilot";

/**
 * How the Copilot CLI starts its ACP server, exactly as upstream launches it (COPILOT_ARGV,
 * src/backend/provider-drivers.ts:395): `--acp` for the protocol, `--no-auto-update` because the CLI would
 * otherwise run its newest cached package (docs/architecture/providers.md:1215-1219).
 */
export const copilotAcpArgs = ["--acp", "--no-auto-update"] as const;

/**
 * Every Copilot process gets `COPILOT_AUTO_UPDATE=false` upstream (COPILOT_ENV, src/backend/cli.ts:804) — the
 * same squeeze on every spawn, harness and probes alike, the Muse precedent.
 */
export const copilotSpawnEnv = { COPILOT_AUTO_UPDATE: "false" } as const;

/**
 * The `--version` line the audited CLI answers (`copilot --version`, itself run with the update squeezed
 * off): "Copilot CLI vX.Y.Z" first, any bare semver second, exactly upstream's parseCopilotVersion
 * (src/backend/cli.ts:788-797). The locked generation is 1.0.105.
 */
export const acceptsCopilotVersionLine = (line: string): boolean =>
  /\bCopilot CLI[ \t]+v?(\d+\.\d+\.\d+)\b/iu.test(line) || /\b\d+\.\d+\.\d+\b/u.test(line.trim());

/**
 * Copilot's sign-in runs `copilot login` (src/backend/provider-drivers.ts:1179-1183), which opens GitHub's
 * page in the system browser and takes the result on a 127.0.0.1 callback; the same command's
 * `--device-code` variant prints a visiting page and code (provider-drivers.ts:1184-1191) for a joined
 * host. The update squeeze goes through the environment, because `copilot login` refuses `--no-auto-update`
 * (docs/architecture/providers.md:1215).
 */
export const copilotSignInArgs = ["login"] as const;
export const copilotDeviceCodeSignInArgs = ["login", "--device-code"] as const;
export const copilotSignInEnv = { ...copilotSpawnEnv } as const;

/**
 * The Copilot CLI has no sign-out command of its own: upstream signs out by starting the ACP server and
 * calling its `logout` method (provider-drivers.ts:1192, docs/architecture/providers.md:1228-1229). Outlore
 * leaves the computer's sign-in to the CLI's own terminal surface, so a sign-out story lands with the same
 * live checks as the sign-in.
 */
export const copilotSignOutArgs = null;

/**
 * No update command of Copilot's own exists upstream; its self-update is squeezed off at every spawn by the
 * `--no-auto-update` flag and `COPILOT_AUTO_UPDATE=false` (see the launch facts), so registration refuses
 * Update and passes the squeeze on every process, the Muse precedent.
 */
export const copilotUpdateArgs = null;

/**
 * The error code a signed-out Copilot process answers `session/new` with (-32000,
 * docs/architecture/providers.md:1230): a start or probe against the unsigned computer fails there, which
 * registration reads as "not signed in" rather than retrying, the Hermes probe precedent.
 */
export const copilotSignedOutCode = -32000;

/**
 * Copilot's sign-in lives in the system keychain and the CLI's driver offers no added-account support at
 * all — no key accounts, no home variable (the whole driver entry, src/backend/provider-drivers.ts:
 * 1176-1230): registration takes the computer's own sign-in only, the Muse precedent.
 */
export const copilotSupportsAddedAccounts = false;

/**
 * Environment variables that change which sign-in a Copilot process uses, in the CLI's own order of
 * preference over its keychain sign-in (docs/architecture/providers.md:1226-1227). Outlore never sets them;
 * one found in the inherited environment would silently select another account, which registration is
 * free to prevent.
 */
export const copilotAccountEnvVariables = ["COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"] as const;

/** How the audited Copilot harness starts. */
export type CopilotProviderOptions = {
  /** The `copilot` executable (or a stand-in in front of one, in checks). */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Copilot's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
};

/** The shared copilot profile, widened: `copilotAcpArgs`/`copilotSpawnEnv` above are its audited shape, and
 * it stops there — no state home, no version gate, the computer-sign-in-only shape the isolation facts name. */
export const copilotProviderProfile: AcpProviderProfile = acpProviderProfiles.copilot;

/**
 * Runs each thread in one long-lived `copilot --acp --no-auto-update` process of the generic ACP adapter:
 * computer sign-in only (no state home to redirect — see the isolation facts above), every permission request
 * mediated through the owner, any other reverse request refused, and no usage surface (upstream's descriptor
 * reports none) until a live CLI proves one.
 */
export const makeCopilotProviderHarness = (options: CopilotProviderOptions) =>
  makeAcpProviderHarness({
    command: options.command,
    idleTimeout: options.idleTimeout,
    ...(options.prefixArgs !== undefined ? { prefixArgs: options.prefixArgs } : {}),
    profile: { ...copilotProviderProfile, env: { ...copilotProviderProfile.env, ...options.env } },
  });

/** Probes a `copilot --acp` process for its models without exposing the thread's own tools. */
export const probeCopilotModels = Effect.fnUntraced(function* (options: {
  readonly command: string;
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
}) {
  return yield* probeAcpProviderModels({
    command: options.command,
    ...(options.prefixArgs !== undefined ? { prefixArgs: options.prefixArgs } : {}),
    profile: { ...copilotProviderProfile, env: { ...copilotProviderProfile.env, ...options.env } },
  });
});
