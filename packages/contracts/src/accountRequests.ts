import { Schema } from "effect";
import { ModelChoice } from "./companions.ts";
import { HarnessList, HarnessName } from "./harnesses.ts";
import { AccountId } from "./ids.ts";
import { TerminalId } from "./terminalRequests.ts";
import { NameText } from "./texts.ts";

/** Every harness with its accounts, sign-in states, and models (provider-accounts). */
export const ListHarnesses = Schema.TaggedStruct("ListHarnesses", {});
/**
 * The effort levels the provider offers for one model, lowest first, without "default"; empty when it offers none.
 * OpenCode says them only for a model once chosen, so its pickers ask when a model is picked; the service reads them ahead when it lists the models.
 */
export const ListModelEfforts = Schema.TaggedStruct("ListModelEfforts", {
  /** The provider account, or null for the harness's own sign-in on this computer. */
  accountId: Schema.NullOr(AccountId),
  harness: HarnessName,
  model: ModelChoice,
});

/** Adds a provider account to a harness, with its own folder; it is signed out until the owner signs in. */
export const AddAccount = Schema.TaggedStruct("AddAccount", { harness: HarnessName, label: NameText });

/** Renames a provider account added in Outlore. */
export const RenameAccount = Schema.TaggedStruct("RenameAccount", { accountId: AccountId, label: NameText });

/**
 * Names a harness's own sign-in on this computer, apart from the computer's name; a blank name returns it to the
 * computer's.
 */
export const RenameOwnAccount = Schema.TaggedStruct("RenameOwnAccount", {
  harness: HarnessName,
  label: Schema.String.check(Schema.isMaxLength(80)),
});

/** Updates a harness to its latest version through the harness's own update command, then lists the harnesses again. */
export const UpdateHarness = Schema.TaggedStruct("UpdateHarness", { harness: HarnessName });

/** Installs a missing harness from its official npm package, then lists the harnesses again. */
export const InstallHarness = Schema.TaggedStruct("InstallHarness", { harness: HarnessName });

/** Removes a provider account and its folder; refused while a thread that is not ended uses it. */
export const RemoveAccount = Schema.TaggedStruct("RemoveAccount", { accountId: AccountId });

/**
 * Runs the harness's own sign-in for an account on this computer; Outlore never sees the credentials (requirements, Comply with provider terms).
 * Null signs in the computer's own account.
 * A sign-in that needs no terminal runs in the background, waits for the owner in the browser, and answers with the harnesses listed again.
 * One that needs a terminal starts inside Outlore's host-side PTY service and answers with its terminal session identifier.
 */
export const SignInAccount = Schema.TaggedStruct("SignInAccount", {
  accountId: Schema.NullOr(AccountId),
  harness: HarnessName,
});

/** An interactive sign-in running inside Outlore's inline terminal. */
export const SignInTerminal = Schema.Struct({
  /** The terminal session identifier to attach the inline terminal panel to. */
  terminalId: TerminalId,
  /** A short title describing the sign-in running in the terminal. */
  title: Schema.String,
});
export type SignInTerminal = typeof SignInTerminal.Type;

/** What SignInAccount answers: either the updated harnesses after a background sign-in, or an inline terminal session to interact with. */
export const SignInResult = Schema.Union([
  Schema.TaggedStruct("Finished", { harnesses: HarnessList }),
  Schema.TaggedStruct("Terminal", { terminal: SignInTerminal }),
]);
export type SignInResult = typeof SignInResult.Type;
