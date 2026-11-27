import { join } from "node:path";
import { type HarnessName, type KeyProviderName, keyProviders } from "@outlore/contracts";
import { Effect, Option, Predicate, Schema } from "effect";
import * as Secret from "effect/Redacted";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import {
  claudeKeyEnvironmentOf,
  forgetKeyEnvironment,
  hasKeyEnvironment,
  rememberKeyEnvironment,
} from "../harness/index.ts";
import type { Vault } from "../vault/index.ts";

// API key accounts (provider-accounts): where an account's key is kept and how its environment is made from it.
// The key is sealed in the Vault under a connector id of its own; the store keeps only the provider and the model names.

/** The kind of secret an account's key is in the Vault. */
export const accountKeyKind = "API key";

/** An added account's folder. */
export const accountFolderOf = (accountsRoot: string, accountId: string) => join(accountsRoot, accountId);

/** The Vault's connector id for an account's key; a Vault id is letters, digits and underscores, so the id's dashes go. */
export const keyConnectorIdOf = (accountId: string) => `account_${accountId.replaceAll("-", "")}`;

/** Whether a Vault connector id is an account's key, not a connector's: the Vault's section leaves these out. */
export const isAccountKeyConnector = (connectorId: string) => connectorId.startsWith("account_");

/** One row from the `accounts` table. */
export type AccountRow = {
  readonly harness: HarnessName;
  readonly id: string;
  readonly keyModels: string | null;
  readonly keyProvider: string | null;
  readonly label: string;
};

/** The part of an account row a key's environment is made from. */
export type KeyAccountRow = {
  readonly id: string;
  readonly keyModels: string | null;
  readonly keyProvider: string | null;
};

/** Reads one added account row by id, failing with NotFound when none exists. */
export const readAccount = Effect.fnUntraced(function* (accountId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] =
    yield* sql<AccountRow>`SELECT id, harness, label, key_provider AS keyProvider, key_models AS keyModels FROM accounts WHERE id = ${accountId}`;
  if (row === undefined) return yield* notFound("No such account.");
  return row;
});

/** Validates and trims an account label, failing when blank. */
export const trimmedLabel = (label: string) =>
  label.trim() === "" ? invalid("Give the account a name.") : Effect.succeed(label.trim());

const decodeStoredKeyModels = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Array(Schema.Unknown)));

/** The models of a key account: the ones the owner named, or the provider's own. */
export const keyModelIdsOf = (provider: KeyProviderName, keyModels: string | null): ReadonlyArray<string> => {
  if (keyModels !== null) {
    const decoded = decodeStoredKeyModels(keyModels);
    if (Option.isSome(decoded)) {
      const ids = decoded.value.filter((id): id is string => Predicate.isString(id) && id !== "");
      if (ids.length > 0) return ids;
    }
  }
  return keyProviders[provider].models.map((model) => model.id);
};

/** Whether a stored provider name is one the host knows. */
export const isKeyProvider = (name: string | null): name is KeyProviderName =>
  name !== null && Object.hasOwn(keyProviders, name);

/**
 * Reads an account's key from the Vault and holds its environment for the harness's launches.
 * A Vault that cannot answer (locked, key lost, secret missing) leaves the account without an environment, so it reads as signed out instead of running unsigned.
 */
export const loadAccountKey = Effect.fnUntraced(function* (
  vault: Vault["Service"],
  accountsRoot: string,
  row: KeyAccountRow,
) {
  if (!isKeyProvider(row.keyProvider)) return;
  const provider = row.keyProvider;
  const directory = accountFolderOf(accountsRoot, row.id);
  const modelIds = keyModelIdsOf(provider, row.keyModels);
  yield* vault
    .withSecret(keyConnectorIdOf(row.id), accountKeyKind, (secret) =>
      Effect.sync(() =>
        rememberKeyEnvironment(directory, claudeKeyEnvironmentOf(provider, Secret.value(secret), modelIds)),
      ),
    )
    .pipe(Effect.catchTag("VaultFailure", () => Effect.sync(() => forgetKeyEnvironment(directory))));
});

/** Loads the key of every key account that has none held yet. */
export const loadAccountKeys = (vault: Vault["Service"], accountsRoot: string, rows: ReadonlyArray<KeyAccountRow>) =>
  Effect.forEach(
    rows.filter((row) => row.keyProvider !== null && !hasKeyEnvironment(accountFolderOf(accountsRoot, row.id))),
    (row) => loadAccountKey(vault, accountsRoot, row),
    { discard: true },
  );

/** Loads one account's key before a turn starts on it, when it is a key account whose key is not held yet; a sign-in account is left alone. */
export const prepareAccountKey = Effect.fnUntraced(function* (
  vault: Vault["Service"],
  accountsRoot: string,
  accountId: string | null,
) {
  if (accountId === null) return;
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<KeyAccountRow>`
    SELECT id, key_provider AS keyProvider, key_models AS keyModels FROM accounts WHERE id = ${accountId}`;
  yield* loadAccountKeys(vault, accountsRoot, rows);
});
