import { realmSlugOf } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { realFolderOf } from "../core/index.ts";
import { findRealmMatches, hasActiveRealmName } from "./realmResolution.ts";

// The checks Chronicler's realm tools make before they act. The provenance module (guildmasterProvenance.ts) runs the
// same ones to decide whether there is anything to ask the owner about, so an action a tool would refuse is never
// put to them as a question.

/** What a realm tool found before acting: a refusal with the words that tell Chronicler why, or what it would act on. */
export type RealmCheck<Clear> =
  | { readonly _tag: "Refused"; readonly text: string }
  | ({ readonly _tag: "Clear" } & Clear);

const refused = (text: string) => ({ _tag: "Refused", text }) as const;

/** `create_realm` checks folder uniqueness and reports an active name collision for explicit confirmation. */
export const checkRealmCreation = Effect.fnUntraced(function* (given: {
  readonly folder?: string | undefined;
  readonly name: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  const name = realmSlugOf(given.name);
  if (name === "") return refused("Not done: a realm needs a name.");
  const hasDuplicateName = yield* hasActiveRealmName(name);
  const folder = given.folder === undefined || given.folder.trim() === "" ? null : given.folder.trim();
  const real = folder === null ? null : ((yield* realFolderOf(folder)) ?? folder);
  if (real !== null) {
    const [tied] = yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${real} LIMIT 1`;
    if (tied !== undefined)
      return refused(`Not done: the folder ${folder} already belongs to a realm. Rename that realm instead.`);
  }
  return { _tag: "Clear", folder, hasDuplicateName, name, real } as const;
});

/** `rename_realm` resolves one unambiguous target and reports whether the proposed name needs a warning. */
export const checkRealmRename = Effect.fnUntraced(function* (given: { readonly name: string; readonly realm: string }) {
  const matches = yield* findRealmMatches(given.realm, false);
  const [realm] = matches;
  if (realm === undefined || matches.length > 1)
    return refused(`Not done: no realm "${given.realm}" matches uniquely. Use its id or folder when names repeat.`);
  const name = realmSlugOf(given.name);
  if (name === "") return refused("Not done: a realm needs a name.");
  const hasDuplicateName = yield* hasActiveRealmName(name, realm.id);
  return { _tag: "Clear", hasDuplicateName, name, realm } as const;
});
