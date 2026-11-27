import { mkdirSync, rmSync } from "node:fs";
import type { AccountId, AccountStatus, HarnessInfo, HarnessList, HarnessName } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, newId, notFound } from "../core/index.ts";
import {
  forgetKeyEnvironment,
  HarnessTools,
  harnessLabels,
  harnessNames,
  refusesAddedAccounts,
  type SignInStatus,
} from "../harness/index.ts";
import { ownAccountLabelOf } from "../remote/index.ts";
import type { Vault } from "../vault/index.ts";
import {
  type AccountRow,
  accountFolderOf,
  isKeyProvider,
  keyConnectorIdOf,
  loadAccountKeys,
  readAccount,
  trimmedLabel,
} from "./accountKeys.ts";
import { keyAccountModelsOf, keySignInOf } from "./keyAccounts.ts";
import type { TerminalScope } from "./terminalHost.ts";
import type { ConversationTerminals } from "./terminalSessions.ts";
import { openCommandTerminal } from "./terminals.ts";
import { AccountsRoot } from "./threads.ts";

// Provider accounts (provider-accounts): each harness's own sign-in on this computer, and accounts the owner
// adds, each with its own folder where the harness keeps that account's sign-in and sessions.

/** The config directory of an account's sign-in: the added account's folder, or null for the harness's own. */
export const configDirectoryOf = (accountsRoot: string, accountId: string | null) =>
  accountId === null ? null : accountFolderOf(accountsRoot, accountId);

/** One harness with its accounts' sign-ins, each account's own models, and the models its first signed-in account offers. */
const readHarness = Effect.fnUntraced(function* (harness: HarnessName, rows: ReadonlyArray<AccountRow>) {
  const tools = yield* HarnessTools;
  const accountsRoot = yield* AccountsRoot;
  const installation = yield* tools.inspect(harness);
  const ownLabel = yield* ownAccountLabelOf(harness);
  const listed = [
    { configDirectory: null, id: null, keyProvider: null, label: ownLabel },
    ...rows
      .filter((row) => row.harness === harness)
      .map((row) => ({
        configDirectory: accountFolderOf(accountsRoot, row.id),
        id: row.id as AccountId,
        keyProvider: isKeyProvider(row.keyProvider) ? { models: row.keyModels, name: row.keyProvider } : null,
        label: row.label,
      })),
  ];
  // An uninstalled harness reports nothing: every account reads as unknown.
  const accounts = yield* Effect.forEach(
    listed,
    (account) =>
      (account.keyProvider !== null
        ? // A key account is signed in while its key is held; the harness's own status command knows nothing of it.
          Effect.succeed(keySignInOf(account.keyProvider.name, account.configDirectory ?? ""))
        : installation.problem === null
          ? tools.readSignIn(harness, account.configDirectory)
          : Effect.succeed({ detail: null, signIn: "Unknown" } satisfies SignInStatus)
      ).pipe(
        Effect.map((status): AccountStatus & { configDirectory: string | null } => ({
          ...status,
          configDirectory: account.configDirectory,
          id: account.id,
          ...(account.keyProvider === null ? {} : { keyProvider: account.keyProvider.name }),
          label: account.label,
        })),
      ),
    { concurrency: "unbounded" },
  );
  // The harness's own list comes from a sign-in account: a key account lists its provider's models instead.
  const signedIn =
    accounts.find((account) => account.signIn === "SignedIn" && account.keyProvider === undefined) ?? accounts[0];
  const models =
    installation.problem === null ? yield* tools.listModels(harness, signedIn?.configDirectory ?? null) : [];
  // Each account's own list, read at once and kept per account; a signed-out account lists none.
  const accountModels = yield* Effect.forEach(
    accounts.map((account, index) => ({ account, keyProvider: listed[index]?.keyProvider ?? null })),
    ({ account, keyProvider }) =>
      keyProvider !== null
        ? Effect.succeed(keyAccountModelsOf(keyProvider.name, keyProvider.models))
        : installation.problem !== null || account.signIn === "SignedOut"
          ? Effect.succeed(null)
          : tools.listModels(harness, account.configDirectory),
    { concurrency: "unbounded" },
  );
  const update = installation.problem === null ? yield* tools.findUpdate(harness, installation.version) : null;
  return {
    accounts: accounts.map(({ configDirectory: omitted, ...account }, index) => {
      const own = accountModels[index] ?? null;
      return own === null ? account : { ...account, models: own };
    }),
    models,
    name: harness,
    problem: installation.problem,
    supportsAddedAccounts: !refusesAddedAccounts(harness),
    update,
    version: installation.version,
  } satisfies HarnessInfo;
});

/** The effort levels the provider offers for one model under an account's sign-in (ListModelEfforts). */
export const listModelEfforts = Effect.fnUntraced(function* (
  harness: HarnessName,
  accountId: AccountId | null,
  model: string,
) {
  const tools = yield* HarnessTools;
  const accountsRoot = yield* AccountsRoot;
  if (accountId !== null) {
    const sql = yield* SqlClient.SqlClient;
    const [account] = yield* sql<{ harness: string }>`SELECT harness FROM accounts WHERE id = ${accountId}`;
    if (account?.harness !== harness) return yield* notFound(`No such ${harnessLabels[harness]} account.`);
  }
  return yield* tools.listEfforts(harness, configDirectoryOf(accountsRoot, accountId), model);
});

/** Every harness, with its accounts and models (ListHarnesses). */
export const listHarnesses = Effect.fnUntraced(function* (vault: Vault["Service"]) {
  const sql = yield* SqlClient.SqlClient;
  const accountsRoot = yield* AccountsRoot;
  const rows =
    yield* sql<AccountRow>`SELECT id, harness, label, key_provider AS keyProvider, key_models AS keyModels FROM accounts ORDER BY created_at, rowid`;
  // A key account's key is read from the Vault when its environment is not held yet, as after a start.
  yield* loadAccountKeys(vault, accountsRoot, rows);
  const harnesses = yield* Effect.forEach(harnessNames, (harness) => readHarness(harness, rows), {
    concurrency: "unbounded",
  });
  return { harnesses } satisfies HarnessList;
});

/** Updates a harness through its own update command; refused when it is not installed. */
export const updateHarness = Effect.fnUntraced(function* (harness: HarnessName) {
  const tools = yield* HarnessTools;
  const installation = yield* tools.inspect(harness);
  if (installation.problem !== null) return yield* invalid(installation.problem);
  yield* tools.update(harness);
});

/** Installs a missing harness and verifies that its configured executable can run. */
export const installHarness = Effect.fn("installHarness")(function* (harness: HarnessName) {
  const tools = yield* HarnessTools;
  const before = yield* tools.inspect(harness);
  if (before.problem === null)
    return yield* invalid(`${harnessLabels[harness]} is already installed. Use Update instead.`);
  yield* tools.install(harness);
  const after = yield* tools.inspect(harness);
  if (after.problem !== null)
    return yield* invalid(
      `Installation finished, but ${after.problem} Check your PATH or configured harness path, then press Refresh.`,
    );
});

/** Adds an account with its own empty folder; it is signed out until the owner signs in. */
export const addAccount = Effect.fnUntraced(function* (harness: HarnessName, label: string) {
  const sql = yield* SqlClient.SqlClient;
  const accountsRoot = yield* AccountsRoot;
  // A harness without a verified per-account state home (Muse) takes no added account: it could only share
  // the computer's sign-in invisibly, which reads as isolation it does not have.
  if (refusesAddedAccounts(harness))
    return yield* invalid(`${harnessLabels[harness]} takes only the computer's own sign-in.`);
  const name = yield* trimmedLabel(label);
  const id = yield* newId;
  const now = yield* Clock.currentTimeMillis;
  yield* Effect.sync(() => mkdirSync(accountFolderOf(accountsRoot, id), { recursive: true }));
  yield* sql`INSERT INTO accounts (id, harness, label, created_at) VALUES (${id}, ${harness}, ${name}, ${now})`;
  return id;
});

/** Gives a provider account a new label the owner reads it by. */
export const renameAccount = Effect.fnUntraced(function* (accountId: string, label: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* readAccount(accountId);
  const name = yield* trimmedLabel(label);
  yield* sql`UPDATE accounts SET label = ${name} WHERE id = ${accountId}`;
});

/** Names a harness's own sign-in on this computer apart from the computer's name; a blank name returns it to the computer's. */
export const renameOwnAccount = Effect.fnUntraced(function* (harness: HarnessName, label: string) {
  const sql = yield* SqlClient.SqlClient;
  const name = label.trim();
  if (name === "") return yield* sql`DELETE FROM own_account_labels WHERE harness = ${harness}`;
  yield* sql`INSERT INTO own_account_labels (harness, label) VALUES (${harness}, ${name})
      ON CONFLICT (harness) DO UPDATE SET label = excluded.label`;
});

/**
 * Removes an account and its folder, with the sign-in and sessions the harness kept there. Refused while a
 * mission that is not ended has a thread on it, whose conversation lives in that folder.
 */
export const removeAccount = Effect.fnUntraced(function* (vault: Vault["Service"], accountId: string) {
  const sql = yield* SqlClient.SqlClient;
  const accountsRoot = yield* AccountsRoot;
  const account = yield* readAccount(accountId);
  const [use] = yield* sql<{ count: number }>`
    SELECT COUNT(*) AS count FROM threads t JOIN missions m ON m.id = t.mission_id
    WHERE t.account_id = ${accountId} AND m.ending IS NULL AND t.is_deleting = 0`;
  if ((use?.count ?? 0) > 0)
    return yield* invalid(
      `Not removed: ${use?.count} thread(s) in missions not yet ended run on "${account.label}". End or archive those missions first.`,
    );
  yield* sql`DELETE FROM account_budgets WHERE account_id = ${accountId}`;
  yield* sql`DELETE FROM accounts WHERE id = ${accountId}`;
  // A key account's key goes with it; a Vault that cannot answer leaves the sealed secret, which nothing reads once the account is gone.
  if (isKeyProvider(account.keyProvider)) yield* vault.removeAllOf(keyConnectorIdOf(accountId)).pipe(Effect.ignore);
  yield* Effect.sync(() => forgetKeyEnvironment(accountFolderOf(accountsRoot, accountId)));
  yield* Effect.sync(() => rmSync(accountFolderOf(accountsRoot, accountId), { force: true, recursive: true }));
});

/**
 * Runs the harness's own sign-in for the account, or for the computer's own sign-in when null.
 * Returns "Finished" when it ran without a terminal and ended, or "Terminal" with the inline PTY session started for it.
 */
export const signInAccount = Effect.fnUntraced(function* (
  harness: HarnessName,
  accountId: string | null,
  terminals: ConversationTerminals,
  scope: TerminalScope,
) {
  const tools = yield* HarnessTools;
  const accountsRoot = yield* AccountsRoot;
  if (accountId !== null) {
    const account = yield* readAccount(accountId);
    if (account.harness !== harness) return yield* invalid(`That account is not a ${harnessLabels[harness]} account.`);
    if (isKeyProvider(account.keyProvider))
      return yield* invalid(`"${account.label}" uses an API key; replace the key instead of signing in.`);
  }
  const launch = yield* tools.openSignIn(harness, configDirectoryOf(accountsRoot, accountId));
  if (launch._tag === "Finished") return { _tag: "Finished" as const };
  const terminalId = `sign-in:${harness}:${accountId ?? "own"}`;
  yield* openCommandTerminal(terminals, { command: launch.command, env: launch.env, id: terminalId }, scope);
  return { _tag: "Terminal" as const, terminal: { terminalId, title: `${launch.label} sign-in` } };
});
