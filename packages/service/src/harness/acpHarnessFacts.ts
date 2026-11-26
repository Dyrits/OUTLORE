import type { AcpProviderDefinition } from "./acpProviderDefinition.ts";
import { antigravity } from "./antigravityProvider.ts";
import { cline } from "./clineProvider.ts";
import { copilot } from "./copilotProvider.ts";
import { cursor } from "./cursorProvider.ts";
import { devin } from "./devinProvider.ts";
import { hermes } from "./hermesProvider.ts";
import type { HarnessServiceFacts } from "./nativeHarnessFacts.ts";

/** What the catalog takes from an ACP provider's definition instead of spelling again: its executables and its account isolation. */
const identityOf = (definition: AcpProviderDefinition) => ({
  defaultExecutable: definition.executable,
  isolation: definition.isolation,
  ...(definition.legacyExecutable === undefined ? {} : { legacyExecutable: definition.legacyExecutable }),
});

/** Service-owned catalog facts for harnesses driven by the generic ACP provider adapter. */
export const acpHarnessServiceFacts = {
  antigravity: {
    // A plain ACP server mediated by the generic adapter, so it asks the owner through its protocol's permission requests and has no `answer_prompt` tool.
    approvedCommandAdvice: "",
    // The executable (`agy` or legacy `antigravity`) and home variable come from the definition; added accounts stay blocked until a live CLI check proves which channel wins (antigravityProvider.ts).
    ...identityOf(antigravity),
    canSignInWithoutTerminal: false,
    fixedModels: null,
    hasPromptTool: false,
    installVia: "script",
    // The newest version is what the GitHub releases carry; no registry holds one to read.
    packageName: "",
    releaseRegistry: "none",
    updateArgs: null,
    updateCommand: null,
  },
  cline: {
    // A plain ACP server mediated by the generic adapter, so it asks the owner through its protocol's permission requests and has no `answer_prompt` tool.
    approvedCommandAdvice: "",
    // Upstream has no accounts entry for Cline, and CLINE_DIR/CLINE_DATA_DIR only steer its process confinement: no verified account surface exists, so Cline takes the computer's own sign-in only.
    ...identityOf(cline),
    canSignInWithoutTerminal: false,
    fixedModels: null,
    hasPromptTool: false,
    installVia: "npm",
    packageName: "cline",
    releaseRegistry: "none",
    // No update command of Cline's own exists upstream; its self-update stays squeezed off by the sign-in and launch environment, and Update explains instead of running anything.
    updateArgs: null,
    updateCommand: null,
  },
  copilot: {
    // A plain ACP server mediated by the generic adapter, so it asks the owner through its protocol's permission requests and has no `answer_prompt` tool.
    approvedCommandAdvice: "",
    // The driver upstream keeps no accounts entry for Copilot and its sign-in sits in the system keychain, so only the computer's own sign-in is offered and added accounts are refused rather than silently shared.
    ...identityOf(copilot),
    // `copilot login` opens its browser sign-in; a live check verifies the browser flow's completion.
    canSignInWithoutTerminal: false,
    fixedModels: null,
    hasPromptTool: false,
    installVia: "npm",
    packageName: "@github/copilot",
    releaseRegistry: "none",
    // No update command of Copilot's own exists upstream and its self-update is squeezed off by the environment, so Update explains instead of running anything.
    updateArgs: null,
    updateCommand: null,
  },
  cursor: {
    // A plain ACP server mediated by the generic adapter, so it asks the owner through its protocol's permission requests and has no `answer_prompt` tool.
    approvedCommandAdvice: "",
    // CURSOR_CONFIG_DIR moves Cursor's settings only, never its Keychain sign-in, so only the computer's own sign-in is offered; the executable is `cursor-agent`, never `cursor`.
    ...identityOf(cursor),
    // `cursor-agent login` never opens its page on its own (NO_OPEN_BROWSER prints the sign-in link for the owner to open); a live check verifies the link flow.
    canSignInWithoutTerminal: false,
    fixedModels: null,
    hasPromptTool: false,
    installVia: "script",
    packageName: "",
    releaseRegistry: "none",
    updateArgs: null,
    updateCommand: null,
  },
  devin: {
    // A plain ACP server mediated by the generic adapter, so it asks the owner through its protocol's permission requests and has no `answer_prompt` tool.
    approvedCommandAdvice: "",
    // Upstream keeps no accounts entry for Devin and its state sits under the machine-wide XDG data root, so only the computer's own sign-in is offered and added accounts are refused rather than unisolated.
    ...identityOf(devin),
    // No sign-in command of the CLI's own is verified: its sign-in is the ACP `devin-browser` flow, so Sign-in explains and the owner signs in inside the provider's own surface, then presses Refresh.
    canSignInWithoutTerminal: false,
    fixedModels: null,
    hasPromptTool: false,
    installVia: "script",
    packageName: "",
    releaseRegistry: "none",
    updateArgs: null,
    updateCommand: null,
  },
  hermes: {
    // The generic ACP adapter mediates every permission request itself, so it has no `answer_prompt` tool.
    approvedCommandAdvice: "",
    // Fixed by the adapter: an account's own folder is Hermes's `HERMES_HOME`; turns refuse the user's own Hermes directory (provider-accounts), and models come from the ACP probe, so nothing is fixed here.
    ...identityOf(hermes),
    canSignInWithoutTerminal: false,
    fixedModels: null,
    hasPromptTool: false,
    installVia: "script",
    // The newest version is what its own `hermes update --check` knows; no registry holds it.
    packageName: "",
    releaseRegistry: "none",
    updateArgs: ["update"],
    updateCommand: null,
  },
} as const satisfies Record<"antigravity" | "cline" | "copilot" | "cursor" | "devin" | "hermes", HarnessServiceFacts>;
