import type { CompanionChoice, HarnessList } from "@outlore/contracts";

// The models the `@` menu offers (thread-messaging, Mentioning a Companion with @): one row per model of every signed-in
// account of a harness that can run, read from the harness list.

/** The Companions a typed `@` can ask: each signed-in account's own models, or the harness's when the account lists none. */
export const companionChoicesOf = (list: HarnessList): ReadonlyArray<CompanionChoice> =>
  list.harnesses
    .filter((harness) => harness.problem === null)
    .flatMap((harness) =>
      harness.accounts
        .filter((account) => account.signIn === "SignedIn")
        .flatMap((account) =>
          (account.models ?? harness.models).map(
            (model): CompanionChoice => ({
              accountId: account.id,
              accountLabel: account.label,
              harness: harness.name,
              model: model.id,
              modelLabel: model.label,
            }),
          ),
        ),
    );
