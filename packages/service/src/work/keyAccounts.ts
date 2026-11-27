import { mkdirSync } from "node:fs";
import { type KeyProviderName, keyProviders, type ModelOption } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import type * as Secret from "effect/Redacted";
import { SqlClient } from "effect/sql";
import { invalid, newId } from "../core/index.ts";
import { hasKeyEnvironment, type SignInStatus } from "../harness/index.ts";
import type { Vault } from "../vault/index.ts";
import {
  accountFolderOf,
  accountKeyKind,
  isKeyProvider,
  keyConnectorIdOf,
  keyModelIdsOf,
  loadAccountKey,
  readAccount,
  trimmedLabel,
} from "./accountKeys.ts";
import { AccountsRoot } from "./threads.ts";

// API key account lifecycle and status derivations (provider-accounts): adding, replacing keys, and deriving sign-in and models.

/** A key account's state: signed in while the service holds its key, with the provider named as the detail. */
export const keySignInOf = (provider: KeyProviderName, configDirectory: string): SignInStatus =>
  hasKeyEnvironment(configDirectory)
    ? { detail: `${keyProviders[provider].label} · API key`, signIn: "SignedIn" }
    : { detail: `${keyProviders[provider].label} · API key not readable`, signIn: "SignedOut" };

/**
 * The models a key account offers: the provider's own, or the ones the owner named when it was added.
 * Anthropic's own API with no models named takes the harness's list, which carries each model's efforts.
 */
export const keyAccountModelsOf = (
  provider: KeyProviderName,
  keyModels: string | null,
): ReadonlyArray<ModelOption> | null => {
  if (provider === "anthropic" && keyModels === null) return null;
  const known = new Map<string, string>(keyProviders[provider].models.map((model) => [model.id, model.label]));
  return keyModelIdsOf(provider, keyModels).map((id) => ({ id, label: known.get(id) ?? id }));
};

/**
 * Adds an API key account: the key is sealed in the Vault under the account's own id, its provider and model names go in the store, and its folder holds the harness's sessions as for any added account.
 * Nothing is added when the Vault refuses the key (not ready, or not protected from a harness).
 */
export const addKeyAccount = Effect.fnUntraced(function* (
  vault: Vault["Service"],
  provider: KeyProviderName,
  label: string,
  key: Secret.Redacted<string>,
  models: ReadonlyArray<string> | undefined,
) {
  const sql = yield* SqlClient.SqlClient;
  const accountsRoot = yield* AccountsRoot;
  const harness = keyProviders[provider].harness;
  const name = yield* trimmedLabel(label);
  const named = (models ?? []).map((model) => model.trim()).filter((model) => model !== "");
  if (keyProviders[provider].models.length === 0 && named.length === 0)
    return yield* invalid(`${keyProviders[provider].label} needs at least one model name.`);
  const id = yield* newId;
  const now = yield* Clock.currentTimeMillis;
  yield* vault
    .put({ connectorId: keyConnectorIdOf(id), kind: accountKeyKind, secret: key })
    .pipe(Effect.catchTag("VaultFailure", (failure) => invalid(failure.message)));
  yield* Effect.sync(() => mkdirSync(accountFolderOf(accountsRoot, id), { recursive: true }));
  const keyModels = named.length === 0 ? null : JSON.stringify(named);
  yield* sql`INSERT INTO accounts (id, harness, label, created_at, key_provider, key_models)
    VALUES (${id}, ${harness}, ${name}, ${now}, ${provider}, ${keyModels})`;
  yield* loadAccountKey(vault, accountsRoot, { id, keyModels, keyProvider: provider });
  return id;
});

/** Replaces the key of an API key account; a sign-in account has none to replace. */
export const replaceAccountKey = Effect.fnUntraced(function* (
  vault: Vault["Service"],
  accountId: string,
  key: Secret.Redacted<string>,
) {
  const accountsRoot = yield* AccountsRoot;
  const account = yield* readAccount(accountId);
  if (!isKeyProvider(account.keyProvider)) return yield* invalid(`"${account.label}" signs in, it has no API key.`);
  yield* vault
    .replace({ connectorId: keyConnectorIdOf(accountId), kind: accountKeyKind, secret: key })
    .pipe(
      Effect.catchTag("VaultFailure", (failure) =>
        failure.kind === "Missing"
          ? vault
              .put({ connectorId: keyConnectorIdOf(accountId), kind: accountKeyKind, secret: key })
              .pipe(Effect.catchTag("VaultFailure", (putFailure) => invalid(putFailure.message)))
          : invalid(failure.message),
      ),
    );
  // The held environment was made from the old key: it is made again from the new one.
  yield* loadAccountKey(vault, accountsRoot, account);
});
