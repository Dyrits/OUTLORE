import { Record, Schema } from "effect";
import { AccountId } from "./ids.ts";

// Harnesses and the provider accounts they sign in with (provider-accounts).

/** One harness's shared identity: its owner-facing label, usual model company, and display order. */
export type HarnessDescriptor = {
  /** The usual model company when the model's own identifier names none. */
  readonly company: string;
  /** The harness's name as the owner reads it. */
  readonly label: string;
  /** The harness's position across pickers, Settings, and usage charts, lowest first. */
  readonly order: number;
};

/** Every harness's shared identity, keyed by wire name: the single source of truth for names, labels, companies, and display order. */
export const harnessDescriptors = {
  // Antigravity fronts Google's Gemini models; GitHub Copilot fronts GitHub's; Devin fronts Cognition's.
  antigravity: { company: "Google", label: "Gemini (Antigravity)", order: 11 },
  claude: { company: "Anthropic", label: "Claude Code", order: 0 },
  // Hermes, Muse, Pi, Cline, and Cursor front several companies' models behind their own runtime, so each harness's name stands in for one.
  cline: { company: "Cline", label: "Cline", order: 9 },
  codex: { company: "OpenAI", label: "Codex", order: 1 },
  copilot: { company: "GitHub", label: "GitHub Copilot", order: 8 },
  cursor: { company: "Cursor", label: "Cursor", order: 7 },
  devin: { company: "Cognition", label: "Devin", order: 10 },
  hermes: { company: "Hermes", label: "Hermes", order: 4 },
  muse: { company: "Muse", label: "Muse", order: 5 },
  opencode: { company: "OpenCode", label: "OpenCode", order: 2 },
  pi: { company: "Pi", label: "Pi", order: 6 },
  vibe: { company: "Mistral", label: "Mistral Vibe", order: 3 },
} as const satisfies Record<string, HarnessDescriptor>;

// Uses `.sort` on the fresh array returned by `Record.keys` because Hermes on Android lacks `Array.prototype.toSorted`.
/** Every harness, in the order pickers, Settings, and charts list them. */
export const harnessNames: ReadonlyArray<keyof typeof harnessDescriptors> = Record.keys(harnessDescriptors).sort(
  (current, next) => harnessDescriptors[current].order - harnessDescriptors[next].order,
);

/** The harness a thread runs on, derived from `harnessDescriptors` in display order (ADR 0008). */
export const HarnessName = Schema.Literals(harnessNames);
export type HarnessName = typeof HarnessName.Type;

/** Each harness's name as the owner reads it, derived from `harnessDescriptors`. */
export const harnessLabels: Record<HarnessName, string> = Record.map(
  harnessDescriptors,
  (descriptor) => descriptor.label,
);

/** Each harness's usual model company when the model's own identifier names none, derived from `harnessDescriptors`. */
export const harnessCompanies: Record<HarnessName, string> = Record.map(
  harnessDescriptors,
  (descriptor) => descriptor.company,
);

/**
 * The effort a thread runs with, by the provider's own name for the level, such as "low", "xhigh", or OpenCode's
 * "none"; "default" leaves the model's own. The pickers offer only the levels the provider lists for the model.
 */
export const EffortChoice = Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(40));
export type EffortChoice = typeof EffortChoice.Type;

/** One model a harness offers, by the identifier the harness takes. */
export const ModelOption = Schema.Struct({
  /**
   * The effort levels the provider offers for this model, lowest first, without "default"; absent or empty when the
   * model takes no effort or the harness does not say, and only the model's own default is offered.
   */
  efforts: Schema.optionalKey(Schema.Array(EffortChoice)),
  id: Schema.String,
  /** Whether the model reads images, when the harness says; absent when it does not (message-attachments). */
  inputsImages: Schema.optionalKey(Schema.Boolean),
  label: Schema.String,
});
export type ModelOption = typeof ModelOption.Type;

/** Whether an account's harness is signed in, as the harness's own status command says. */
export const SignInState = Schema.Literals(["SignedIn", "SignedOut", "Unknown"]);
export type SignInState = typeof SignInState.Type;

/**
 * One account a harness can sign in with: the computer's own sign-in (id null), or one added in Outlore,
 * which keeps its own folder for the harness's sign-in and sessions.
 */
export const AccountStatus = Schema.Struct({
  /** Who the harness says is signed in, such as an email or "ChatGPT", or null when it does not say. */
  detail: Schema.NullOr(Schema.String),
  id: Schema.NullOr(AccountId),
  label: Schema.String,
  /**
   * The models this account's harness offers it, since what a subscription lists can differ from another's; absent
   * when it was not read (a signed-out account, an uninstalled harness, or a host older than this field), and the
   * harness's own list stands then.
   */
  models: Schema.optionalKey(Schema.Array(ModelOption)),
  signIn: SignInState,
});
export type AccountStatus = typeof AccountStatus.Type;

/** One harness as the pickers and Settings list it. */
export const HarnessInfo = Schema.Struct({
  accounts: Schema.Array(AccountStatus),
  /** The models the harness offers, none when it cannot list them; no entry stands for "the harness's own default". */
  models: Schema.Array(ModelOption),
  name: HarnessName,
  /** Why the harness cannot run, such as not being installed, or null. */
  problem: Schema.NullOr(Schema.String),
  /** Whether the owner can add accounts beside the computer's own sign-in; false when the harness takes only that one. An older host omits it, which reads as true. */
  supportsAddedAccounts: Schema.optionalKey(Schema.Boolean),
  /** The newer version the harness's own release channel offers, or null when it is up to date or the latest is not known. */
  update: Schema.NullOr(Schema.String),
  /** The installed version, or null when it was not found. */
  version: Schema.NullOr(Schema.String),
});
export type HarnessInfo = typeof HarnessInfo.Type;

/** Every harness, in a fixed order. */
export const HarnessList = Schema.Struct({ harnesses: Schema.Array(HarnessInfo) });
export type HarnessList = typeof HarnessList.Type;
