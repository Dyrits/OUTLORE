import type { EffortChoice, ModelOption } from "@outlore/contracts";
import { type AccountIsolation, computerOnlyIsolation, singleVarIsolation } from "./accountIsolation.ts";

/** The effort levels Claude Code offers for each model below (`supportedEffortLevels` in its initialize reply, read on 2026-11-11). */
const claudeEfforts: ReadonlyArray<EffortChoice> = ["low", "medium", "high", "xhigh", "max"];

/** The cheapest model Outlore knows for Claude Code, where Chronicler, which only routes, starts. */
export const claudeCheapestModel = "claude-haiku-5-5";

/** Claude Code's models by full identifier, newest family first; legacy aliases stay valid for existing threads. */
export const claudeModels: ReadonlyArray<ModelOption> = [
  { efforts: claudeEfforts, id: "claude-fable-5-2", label: "Fable 5.2" },
  { efforts: claudeEfforts, id: "claude-opus-5-5", label: "Opus 5.5" },
  { efforts: claudeEfforts, id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { efforts: claudeEfforts, id: claudeCheapestModel, label: "Haiku 5.5" },
];

/** How a thread on a sandboxed harness is told to leave its sandbox, when allowed or when asking. */
export type SandboxAdvice = {
  readonly allowed: string;
  readonly asking: string | null;
};

/** Service-owned facts for one harness before merging shared identity fields from `@outlore/contracts`. */
export type HarnessServiceFacts = {
  /** What a command approved through `request_approval` needs on this harness, appended to that rule. */
  readonly approvedCommandAdvice: string;
  /** The default executable name when no `OUTLORE_<HARNESS>_PATH` override is set. */
  readonly defaultExecutable: string;
  /** The harness's own fixed list of models, or null when its tool lists them. */
  readonly fixedModels: ReadonlyArray<ModelOption> | null;
  /** Whether an account's own folder isolates the harness's sign-in and sessions, and which variables point it there; every surface derives from it. */
  readonly isolation: AccountIsolation;
  /** Whether the harness asks its permission prompts through the `answer_prompt` thread tool (ADR 0005). */
  readonly hasPromptTool: boolean;
  /** The distribution method the Workshop uses to install the harness. */
  readonly installVia: "npm" | "uv" | "script";
  /** An older executable name preferred when already installed on `PATH`, or omitted when none exists. */
  readonly legacyExecutable?: string;
  /** The package whose newest release is the harness's newest; read from its registry (`releaseRegistry`). */
  readonly packageName: string;
  /** Where the newest release's version is read: npm, PyPI, or "none" when the harness reports no registry version. */
  readonly releaseRegistry: "npm" | "pypi" | "none";
  /** How to leave this harness's sandbox, when its adapter runs a native escalation; omitted for unprotected harnesses. */
  readonly sandboxAdvice?: SandboxAdvice;
  /** The arguments of the harness's own sign-in command for native adapters; null when unverified, absent for ACP providers. */
  readonly signInArgs?: ReadonlyArray<string> | null;
  /** The environment that sign-in command runs with, left out when it needs none; never carried on turns. */
  readonly signInEnv?: Readonly<Record<string, string>>;
  /** Whether sign-in runs without a terminal by opening the browser itself; otherwise it runs in an inline terminal. */
  readonly canSignInWithoutTerminal: boolean;
  /** The arguments of the harness's own update command, or null when it has none. */
  readonly updateArgs: ReadonlyArray<string> | null;
  /** The executable the update command runs on when it is not the harness's own command; else null. */
  readonly updateCommand: string | null;
};

/** Service-owned catalog facts for harnesses that run through dedicated native adapters. */
export const nativeHarnessServiceFacts = {
  claude: {
    approvedCommandAdvice:
      "; keep the sandbox for it, unless the owner allowed that exact command outside the sandbox: then set dangerouslyDisableSandbox to true",
    canSignInWithoutTerminal: true,
    defaultExecutable: "claude",
    fixedModels: claudeModels,
    hasPromptTool: true,
    installVia: "npm",
    isolation: singleVarIsolation("CLAUDE_CONFIG_DIR"),
    packageName: "@anthropic-ai/claude-code",
    releaseRegistry: "npm",
    sandboxAdvice: {
      allowed:
        "Your commands run in Claude Code's sandbox, which writes your working folder and the git worktrees git lists for its repository. The owner has allowed you to work outside the sandbox: when it blocks a command you need, run it again with dangerouslyDisableSandbox set to true and it runs without a question. Keep to the sandbox for work in your folder and its worktrees, and still ask before the consequential actions above, which the sandbox does not make safe.",
      asking:
        "Your commands run in Claude Code's sandbox, which writes your working folder and the git worktrees git lists for its repository. Do not run a command outside the sandbox for work in them. When the sandbox blocks a command you need for any other reason, run it again with dangerouslyDisableSandbox set to true: Outlore asks the owner about that exact command and nothing broader. Never chain anything else to it.",
    },
    signInArgs: ["auth", "login"],
    updateArgs: ["update"],
    updateCommand: null,
  },
  codex: {
    approvedCommandAdvice: "",
    canSignInWithoutTerminal: true,
    defaultExecutable: "codex",
    fixedModels: null,
    hasPromptTool: false,
    installVia: "npm",
    isolation: singleVarIsolation("CODEX_HOME"),
    packageName: "@openai/codex",
    releaseRegistry: "npm",
    sandboxAdvice: {
      allowed:
        "If the sandbox blocks a local command you need, retry it through Codex's own per-command escalation. Outlore approves that escalation automatically in Full access. Use request_approval for consequential actions listed above. A request to widen the sandbox for the turn still asks.",
      asking: null,
    },
    signInArgs: ["login"],
    updateArgs: ["update"],
    updateCommand: null,
  },
  muse: {
    // The Muse adapter mediates approvals itself, so it has no `answer_prompt` tool.
    approvedCommandAdvice: "",
    canSignInWithoutTerminal: false,
    defaultExecutable: "muse",
    fixedModels: null,
    hasPromptTool: false,
    installVia: "script",
    // No per-account state home is verified (its root is the shared XDG data dir), so only the computer's own sign-in is offered and added accounts are refused rather than silently sharing it (Muse, 2026-11-22).
    isolation: computerOnlyIsolation("No per-account state home is verified: its root is the shared XDG data dir."),
    // The newest version is what the muse-stable channel carries; no registry holds the CLI.
    packageName: "",
    releaseRegistry: "none",
    // `muse login` opens its device page only from a real terminal, so sign-in opens one.
    signInArgs: ["login"],
    // The CLI has no update command; Outlore sets MUSE_NO_AUTO_UPDATE on every spawn, so it never updates itself through us, and Update explains instead of running anything.
    updateArgs: null,
    updateCommand: null,
  },
  opencode: {
    approvedCommandAdvice: "",
    canSignInWithoutTerminal: false,
    // OpenCode keeps its sign-ins and sessions under its data folder (`$XDG_DATA_HOME/opencode`).
    defaultExecutable: "opencode",
    fixedModels: null,
    hasPromptTool: false,
    installVia: "npm",
    isolation: singleVarIsolation("XDG_DATA_HOME"),
    packageName: "opencode-ai",
    releaseRegistry: "npm",
    signInArgs: ["auth", "login"],
    updateArgs: ["upgrade"],
    updateCommand: null,
  },
  pi: {
    // Pi's fail-closed adapter never runs a tool Outlore did not approve (piTools.ts), so it asks the owner about nothing through an `answer_prompt` tool.
    approvedCommandAdvice: "",
    canSignInWithoutTerminal: false,
    // Each account is Pi's own state directory (`PI_CODING_AGENT_DIR`, default `~/.pi/agent`), holding the sign-in (auth.json), settings, and sessions; the computer's own sign-in is the unredirected default.
    defaultExecutable: "pi",
    fixedModels: null,
    hasPromptTool: false,
    installVia: "npm",
    isolation: singleVarIsolation("PI_CODING_AGENT_DIR"),
    packageName: "@earendil-works/pi-coding-agent",
    releaseRegistry: "none",
    // Sign-in is `/login` inside Pi's own interactive screen in a terminal window, closed when it is done; a plain `pi` run opens it, so the arguments list is empty.
    signInArgs: [],
    // No update command of Pi's own is verified (its `update --models` only refreshes the model catalog), so Update explains a reinstall from the GitHub releases instead of running anything.
    updateArgs: null,
    updateCommand: null,
  },
  vibe: {
    approvedCommandAdvice: "",
    // `vibe-acp --setup` is an interactive screen, so it needs a Terminal window (like OpenCode).
    canSignInWithoutTerminal: false,
    // Mistral Vibe keeps its sign-in, sessions, and configuration under `$VIBE_HOME` (default `~/.vibe`).
    defaultExecutable: "vibe-acp",
    fixedModels: null,
    hasPromptTool: false,
    // Vibe's update command prompts in a terminal, while uv upgrades the package without one.
    installVia: "uv",
    isolation: singleVarIsolation("VIBE_HOME"),
    packageName: "mistral-vibe",
    releaseRegistry: "pypi",
    signInArgs: ["--setup"],
    updateArgs: ["tool", "upgrade", "mistral-vibe"],
    updateCommand: "uv",
  },
} as const satisfies Record<"claude" | "codex" | "muse" | "opencode" | "pi" | "vibe", HarnessServiceFacts>;
