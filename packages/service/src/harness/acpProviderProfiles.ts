/** The fixed arguments and non-secret environment of an ACP executable. */
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
  /** Minimum major `--version` output of the binary generation this profile was audited against. */
  readonly minMajorVersion?: number;
};

/** The major version of a `--version` line, or null when it carries no number. */
export const acpProviderMajorVersion = (output: string): number | null => {
  const match = /\d+/u.exec(output.trim());
  return match === null ? null : Number.parseInt(match[0], 10);
};

/** Whether a binary's `--version` output belongs to the generation the profile was audited against. */
export const acceptsAcpProviderVersion = (profile: AcpProviderProfile, output: string): boolean => {
  const major = acpProviderMajorVersion(output);
  return major !== null && major >= (profile.minMajorVersion ?? 0);
};

/** Launch profiles; sign-in and account isolation require provider-specific handling. */
export const acpProviderProfiles = {
  antigravity: { args: ["acp"], env: {}, label: "Gemini (Antigravity)" },
  cline: { args: ["--acp"], env: { CLINE_NO_AUTO_UPDATE: "1", CLINE_SESSION_BACKEND_MODE: "local" }, label: "Cline" },
  copilot: { args: ["--acp", "--no-auto-update"], env: { COPILOT_AUTO_UPDATE: "false" }, label: "GitHub Copilot" },
  cursor: { args: ["acp"], env: {}, label: "Cursor" },
  devin: { args: ["acp"], env: {}, label: "Devin" },
  // Only Hermes is live-verified so far (v0.22.6, 2026-11-22): initialize and session/new work over stdio
  // pipes, with logs on stderr so stdout stays clean JSON-RPC. Its home must be a configured account home
  // first - `HERMES_HOME=<dir> hermes pm repair`, then a config.yaml default model: an empty home fails
  // session/new with a misleading -32603 "storage_unavailable", because the session receipt's empty model
  // is refused by the gateway's restore_policy. So Hermes declares needsConfiguredStateHome: the probe takes
  // the account home as `stateHome` and the turn adapter takes the thread's account folder, never the temp
  // redirect a provider like Kimi tolerates. Also: stdout must stay a pipe (a regular file crashes the acp
  // client's connect_write_pipe), and each home grows a detached `--idle-exit` gateway that survives the
  // killed RPC process tree (keep per-account HERMES_HOME paths short enough for its gateway.sock; the
  // longer-path /tmp fallback for the socket can be EPERM-denied in a sandbox).
  hermes: {
    args: ["acp"],
    env: {},
    label: "Hermes",
    needsConfiguredStateHome: true,
    stateHomeEnv: "HERMES_HOME",
  },
  // Current-generation kimi-code only (2.x): the archived Python kimi-cli reports 1.x and does
  // not implement the configOptions and reverse-RPC approval surface this profile was audited on.
  // The execution adapter stays unexposed (blocked) on the config-level yolo keys: kimi-code's config can carry
  // `yolo` (node-sdk/src/config/toml.ts keeps the scalar while deleting legacy `default_yolo`/`defaultYolo`),
  // ConfigResponse exposes `yolo` and `default_permission_mode` (agent-core-v2 configEvents.ts), and the VS Code
  // runtime applies a global yolo mode on resume (vscode kimi-runtime.ts). ACP sessions do start in the manual
  // "default" mode (acp-server session.ts), but nothing proves every engine path ignores a config-set yolo, so
  // registration waits for proof on a live 2.x binary; probing models with an isolated KIMI_CODE_HOME is safe.
  kimi: {
    args: ["acp"],
    env: {
      KIMI_CLI_NO_AUTO_UPDATE: "1",
      KIMI_CODE_DANGEROUS_COMMAND_GUARD: "true",
      KIMI_CODE_NO_AUTO_UPDATE: "1",
    },
    label: "Kimi",
    minMajorVersion: 2,
    stateHomeEnv: "KIMI_CODE_HOME",
  },
} satisfies Record<string, AcpProviderProfile>;
