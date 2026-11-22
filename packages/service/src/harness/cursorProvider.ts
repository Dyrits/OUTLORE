import { type Duration, Effect } from "effect";
import { type AcpProviderProfile, acpProviderProfiles } from "./acpProviderProfiles.ts";
import { makeAcpProviderHarness, probeAcpProviderModels } from "./acpProviders.ts";

// Cursor through the Cursor CLI's own ACP surface, its fourth-wave entry audited against the pinned upstream
// nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0. This file pins the registration facts the
// survey verified (executable, launch, sign-in, update, isolation, usage) and hands registration the same
// generic ACP adapter Hermes rides (acpProviders.ts): every sensitive action comes as
// `session/request_permission`, each one is answered by asking the owner, and any other reverse request is
// refused (fail closed). The evidence strings below name their source file:line so a later reader can recheck.
// Nothing here registers Cursor; registration stays the seam owner's (CHG-0641).

/**
 * The Cursor CLI's executable is `cursor-agent`, never `cursor` (resolveCursorCli maps the provider to
 * `cursor-agent`, because `cursor` starts the editor; upstream src/backend/cli.ts `cliCommandName` and
 * docs/architecture/providers.md:1079-1081). The path override a future registration might offer therefore
 * selects a `cursor-agent` binary.
 */
export const cursorExecutable = "cursor-agent";

/** How the Cursor CLI starts its ACP server, as upstream launches it (src/backend/provider-drivers.ts:979). */
export const cursorAcpArgs = ["acp"] as const;

/**
 * The `--version` line the audited generation answers (`cursor-agent --version`), exactly upstream's
 * parseCursorVersion shape (src/backend/cli.ts:458-465): a date, an optional build time, and a commit hash,
 * such as the locked 2026.09.28-64d2043. OpenBot's key-account date gate (2026.10.01) is not an
 * execution-generation gate and does not apply: those accounts are rejected below.
 */
export const acceptsCursorVersionLine = (line: string): boolean =>
  /^\d{4}\.\d{2}\.\d{2}(?:-\d{2}-\d{2}-\d{2})?-[0-9a-f]{7,40}$/u.test(line.trim());

/**
 * Cursor's terminal sign-in (upstream codeSignIn, src/backend/provider-drivers.ts:966-969): a link flow that
 * prints its sign-in URL, `NO_OPEN_BROWSER` set so it never opens a page on its own. Upstream also offers an
 * ACP `authenticate` method (`cursor_login`, provider-drivers.ts:963) whose live surface is unproven here, so
 * registration keeps readSignIn Unknown until the owner verifies one real sign-in, as with Pi and Muse.
 */
export const cursorSignInArgs = ["login"] as const;
export const cursorSignInEnv = { NO_OPEN_BROWSER: "1" } as const;

/** Cursor's own terminal sign-out (src/backend/provider-drivers.ts:971). */
export const cursorSignOutArgs = ["logout"] as const;

/**
 * No update command of Cursor's own exists anywhere upstream, and no self-update switch is passed or
 * suppressed (its runtime updates ride OpenBot's own ACP-registry installer, not the CLI), so registration
 * refuses Update, the Pi precedent (parity note, flag-set correction section).
 */
export const cursorUpdateArgs = null;

/**
 * Cursor keeps one sign-in per computer user — the login Keychain on macOS (`cursor-access-token`, account
 * `cursor-user`), `auth.json` under fixed per-platform paths elsewhere — and `CURSOR_CONFIG_DIR` moves only
 * its settings, never the sign-in. So no added-account home exists to isolate: registration takes the
 * computer's own sign-in only, the Muse precedent.
 */
export const cursorSupportsAddedAccounts = false;

/** Environment variables that change which sign-in or credential store a Cursor process uses. */
export const cursorAccountEnvVariables = ["CURSOR_API_KEY", "CURSOR_AUTH_TOKEN", "AGENT_CLI_CREDENTIAL_STORE"] as const;

/**
 * Why an added Cursor account cannot register: upstream's second account is a Cursor API key stored
 * encrypted by the host and passed through the environment (ProviderKeyAccountSupport,
 * src/backend/provider-drivers.ts:972-974), which the no-stored-credentials rule (CHG-0641 admission rule)
 * excludes.
 */
export const cursorAddedAccountEvidence =
  "Cursor's second account upstream is a Cursor API key: ProviderCredentialStore keeps it encrypted under " +
  "`cursor:<account id>` and each account process gets CURSOR_API_KEY, an empty CURSOR_AUTH_TOKEN and " +
  "AGENT_CLI_CREDENTIAL_STORE=memory (nightly-labs/openbot b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0, " +
  "src/backend/provider-drivers.ts:972-974, docs/architecture/providers.md:1091-1101). Outlore never reads, " +
  "stores, or relays credentials (registration design, documentation/research/" +
  "openbot-integration-parity-2026-11-22.md), so no key account is offered and Cursor registers with the " +
  "computer's own sign-in only. A CLI before the audited 2026.10.01 ignores the memory-store variable " +
  "altogether (same source), so nothing about a key account is stable for the machine's user either.";

/**
 * Why Cursor reports no usage: the CLI reports none over ACP (docs/architecture/providers.md:1106), and the
 * reading OpenBot's dock takes pulls the CLI's access token out of the keychain and calls an undocumented
 * api2.cursor.sh endpoint (src/backend/cursor-usage.ts:9-17) — a credential-reading, undocumented surface
 * this harness does not adopt.
 */
export const cursorNoUsageEvidence =
  "Cursor's CLI reports no usage over ACP (nightly-labs/openbot " +
  "b1e5ea74206e1e16fa2eae62d8d131ea1349eaa0, docs/architecture/providers.md:1106). Upstream reads usage by " +
  "taking the CLI's access token from the login Keychain or auth.json and calling the undocumented " +
  "aiserver.v1.DashboardService endpoint at api2.cursor.sh (src/backend/cursor-usage.ts:9-24,100+); Outlore " +
  "never touches the sign-in, so the harness carries no usage surface until a documented one exists.";

/** How the audited Cursor harness starts. */
export type CursorProviderOptions = {
  /** The `cursor-agent` executable (or a stand-in in front of one, in checks). */
  readonly command: string;
  /** How long an idle thread keeps its process. */
  readonly idleTimeout: Duration.Input;
  /** Arguments placed before Cursor's own, used to run a stand-in script in checks. */
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
};

/** The shared cursor profile, widened: `cursorAcpArgs` above is its audited shape, and it stops there —
 * no state home, no version gate, the computer-sign-in-only shape the isolation facts describe. */
export const cursorProviderProfile: AcpProviderProfile = acpProviderProfiles.cursor;

/**
 * Runs each thread in one long-lived `cursor-agent acp` process of the generic ACP adapter: computer sign-in
 * only (no state home to redirect — see the isolation evidence above), every permission request mediated
 * through the owner, any other reverse request refused, and no usage reported.
 */
export const makeCursorProviderHarness = (options: CursorProviderOptions) =>
  makeAcpProviderHarness({
    command: options.command,
    idleTimeout: options.idleTimeout,
    ...(options.prefixArgs !== undefined ? { prefixArgs: options.prefixArgs } : {}),
    profile: { ...cursorProviderProfile, env: { ...cursorProviderProfile.env, ...options.env } },
  });

/** Probes a `cursor-agent acp` process for its models without exposing the thread's own tools. */
export const probeCursorModels = Effect.fnUntraced(function* (options: {
  readonly command: string;
  readonly prefixArgs?: ReadonlyArray<string>;
  /** Extra environment for the whole process, such as a stand-in's knobs in checks. */
  readonly env?: Record<string, string>;
}) {
  return yield* probeAcpProviderModels({
    command: options.command,
    ...(options.prefixArgs !== undefined ? { prefixArgs: options.prefixArgs } : {}),
    profile: { ...cursorProviderProfile, env: { ...cursorProviderProfile.env, ...options.env } },
  });
});
