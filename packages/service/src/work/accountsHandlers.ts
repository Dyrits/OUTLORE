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
/** Requests for accounts share the service request context. */
export const accountsHandlers = ({ change }: Pick<HandlerDependencies, "change">) => {
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
    SignInAccount: (given) => signInAccount(given.harness, given.accountId).pipe(Effect.as(null)),
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
