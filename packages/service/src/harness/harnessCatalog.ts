import type { EffortChoice, HarnessName, ModelOption } from "@outlore/contracts";

// What Outlore knows of each harness without running it (provider-accounts). The registry (harnesses.ts)
// adds how each one runs; these facts stay apart so the modules a harness's adapter needs can read them.

/**
 * The effort levels Claude Code offers for each model below, as its own model list says (`supportedEffortLevels` in
 * its initialize reply, read on 2026-11-11, matching its `--effort` values); check again when adding a model.
 */
const claudeEfforts: ReadonlyArray<EffortChoice> = ["low", "medium", "high", "xhigh", "max"];

/** The cheapest model Outlore knows for Claude Code, where Chronicler, which only routes, starts. */
export const claudeCheapestModel = "claude-haiku-5-5";

/**
 * Claude Code's models, each by its full identifier so the owner picks a version, newest family first. The
 * aliases (`opus`, `sonnet`) stay valid for threads that already use them but are no longer offered.
 */
export const claudeModels: ReadonlyArray<ModelOption> = [
  { efforts: claudeEfforts, id: "claude-fable-5-2", label: "Fable 5.2" },
  { efforts: claudeEfforts, id: "claude-opus-5-5", label: "Opus 5.5" },
  { efforts: claudeEfforts, id: "claude-sonnet-5-5", label: "Sonnet 5.5" },
  { efforts: claudeEfforts, id: claudeCheapestModel, label: "Haiku 5.5" },
];

/** What Outlore knows of one harness without running it. */
export type HarnessFacts = {
  /** What a command approved through `request_approval` needs on this harness, appended to that rule. */
  readonly approvedCommandAdvice: string;
  /** Where the harness keeps its sign-in and sessions, set to an account's own folder for an added account. */
  readonly configVariable: string;
  /** The harness's own fixed list of models, or null when its tool lists them. */
  readonly fixedModels: ReadonlyArray<ModelOption> | null;
  /** Whether the harness asks its permission prompts through the `answer_prompt` thread tool (ADR 0005). */
  readonly hasPromptTool: boolean;
  /** The tool that installs the harness's official package when the Workshop offers Install: npm, or uv for a Python package. */
  readonly installVia: "npm" | "uv";
  /** The harness's name as the owner reads it. */
  readonly label: string;
  /** The package whose newest release is the harness's newest; read from its registry (`releaseRegistry`). */
  readonly packageName: string;
  /** Where the newest release's version is read: the npm registry or PyPI's JSON API. */
  readonly releaseRegistry: "npm" | "pypi";
  /** The arguments of the harness's own sign-in command. */
  readonly signInArgs: ReadonlyArray<string>;
  /**
   * Whether the sign-in runs without a terminal: it opens the browser itself and ends when the browser's answer reaches
   * a local port. Otherwise it is an interactive screen that needs a terminal window.
   */
  readonly signInNeedsNoTerminal: boolean;
  /** The arguments of the harness's own command that updates it, which knows how it was installed. */
  readonly updateArgs: ReadonlyArray<string>;
  /** The executable the update command runs on when it is not the harness's own command (Vibe updates through `vibe`); else null. */
  readonly updateCommand: string | null;
};

/** Each harness's facts, by name. */
export const harnessFacts = {
  claude: {
    approvedCommandAdvice:
      "; keep the sandbox for it, unless the owner allowed that exact command outside the sandbox: then set dangerouslyDisableSandbox to true",
    configVariable: "CLAUDE_CONFIG_DIR",
    fixedModels: claudeModels,
    hasPromptTool: true,
    installVia: "npm",
    label: "Claude Code",
    packageName: "@anthropic-ai/claude-code",
    releaseRegistry: "npm",
    signInArgs: ["auth", "login"],
    signInNeedsNoTerminal: true,
    updateArgs: ["update"],
    updateCommand: null,
  },
  codex: {
    approvedCommandAdvice: "",
    configVariable: "CODEX_HOME",
    fixedModels: null,
    hasPromptTool: false,
    installVia: "npm",
    label: "Codex",
    packageName: "@openai/codex",
    releaseRegistry: "npm",
    signInArgs: ["login"],
    signInNeedsNoTerminal: true,
    updateArgs: ["update"],
    updateCommand: null,
  },
  opencode: {
    approvedCommandAdvice: "",
    // OpenCode keeps its sign-ins and sessions under its data folder (`$XDG_DATA_HOME/opencode`).
    configVariable: "XDG_DATA_HOME",
    fixedModels: null,
    hasPromptTool: false,
    installVia: "npm",
    label: "OpenCode",
    packageName: "opencode-ai",
    releaseRegistry: "npm",
    signInArgs: ["auth", "login"],
    signInNeedsNoTerminal: false,
    updateArgs: ["upgrade"],
    updateCommand: null,
  },
  vibe: {
    approvedCommandAdvice: "",
    // Mistral Vibe keeps its sign-in, sessions, and configuration under `$VIBE_HOME` (default `~/.vibe`).
    configVariable: "VIBE_HOME",
    fixedModels: null,
    hasPromptTool: false,
    // Vibe is a Python package, installed with uv; its `vibe` command updates it the way it was installed.
    installVia: "uv",
    label: "Mistral Vibe",
    packageName: "mistral-vibe",
    releaseRegistry: "pypi",
    signInArgs: ["--setup"],
    // `vibe-acp --setup` is an interactive screen, so it needs a Terminal window (like OpenCode).
    signInNeedsNoTerminal: false,
    updateArgs: ["update"],
    updateCommand: "vibe",
  },
} as const satisfies Record<HarnessName, HarnessFacts>;

/** Each harness's name as the owner reads it. */
export const harnessLabels = {
  claude: harnessFacts.claude.label,
  codex: harnessFacts.codex.label,
  opencode: harnessFacts.opencode.label,
  vibe: harnessFacts.vibe.label,
} as const satisfies Record<HarnessName, string>;

/** Every harness, in the order pickers list them. */
export const harnessNames: ReadonlyArray<HarnessName> = ["claude", "codex", "opencode", "vibe"];

/** The environment that points a harness at an account's folder; empty for the computer's own sign-in. */
export const accountEnvironmentOf = (harness: HarnessName, configDirectory: string | null): Record<string, string> =>
  configDirectory === null ? {} : { [harnessFacts[harness].configVariable]: configDirectory };
