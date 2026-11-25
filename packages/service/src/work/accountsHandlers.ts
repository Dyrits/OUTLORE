import { Effect } from "effect";
import type { SqlError } from "effect/sql";
import type { ServiceFailure } from "../core/index.ts";
import {
  addAccount,
  installHarness,
  listHarnesses,
  listModelEfforts,
  removeAccount,
  renameAccount,
  renameOwnAccount,
  signInAccount,
  updateHarness,
} from "./accounts.ts";
import type { HandlerDependencies, OwnerHandlers } from "./requestContext.ts";
import type { TerminalScope } from "./terminalHost.ts";
import type { ConversationTerminals } from "./terminalSessions.ts";
/** Requests for accounts share the service request context. */
export const accountsHandlers = (
  { change }: Pick<HandlerDependencies, "change">,
  terminals: ConversationTerminals,
  scope: TerminalScope,
) => {
  const thenListHarnesses = <A, R>(work: Effect.Effect<A, ServiceFailure | SqlError.SqlError, R>) =>
    change(work).pipe(Effect.andThen(listHarnesses));
  return {
    AddAccount: (add) => thenListHarnesses(addAccount(add.harness, add.label)),
    InstallHarness: (given) => installHarness(given.harness).pipe(Effect.andThen(listHarnesses)),
    ListHarnesses: () => listHarnesses,
    ListModelEfforts: (list) => listModelEfforts(list.harness, list.accountId, list.model),
    RemoveAccount: (remove) => thenListHarnesses(removeAccount(remove.accountId)),
    RenameAccount: (rename) => thenListHarnesses(renameAccount(rename.accountId, rename.label)),
    RenameOwnAccount: (rename) => thenListHarnesses(renameOwnAccount(rename.harness, rename.label)),
    // Not a command either: a sign-in without a terminal waits minutes for the owner in the browser.
    SignInAccount: (given) =>
      Effect.gen(function* () {
        const outcome = yield* signInAccount(given.harness, given.accountId, terminals, scope);
        if (outcome._tag === "Finished") {
          const harnesses = yield* listHarnesses;
          return { _tag: "Finished" as const, harnesses };
        }
        return outcome;
      }),
    // Not a command: the harness's own update runs for minutes and must not hold the command queue.
    UpdateHarness: (given) => updateHarness(given.harness).pipe(Effect.andThen(listHarnesses)),
  } satisfies OwnerHandlers<
    | "AddAccount"
    | "InstallHarness"
    | "ListHarnesses"
    | "ListModelEfforts"
    | "RemoveAccount"
    | "RenameAccount"
    | "RenameOwnAccount"
    | "SignInAccount"
    | "UpdateHarness"
  >;
};
