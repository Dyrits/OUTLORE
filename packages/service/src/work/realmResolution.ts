import { Effect } from "effect";
import { SqlClient } from "effect/sql";

type RealmMatch = {
  readonly id: string;
  readonly name: string;
  readonly path: string | null;
};

/** Lists active realms matching the name or reserved folder, including state used for authorization. */
export const listRealmCollisions = Effect.fnUntraced(function* (
  name: string,
  folder: string | null = null,
  exceptId: string | null = null,
) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql<RealmMatch>`SELECT id, name, path FROM workspaces WHERE archived_at IS NULL
    AND (lower(name) = lower(${name}) OR path = ${folder}) AND id IS NOT ${exceptId} ORDER BY id`;
});

/** Tells whether an active realm other than the given one already uses the name. */
export const hasActiveRealmName = (name: string, exceptId: string | null = null) =>
  listRealmCollisions(name, null, exceptId).pipe(Effect.map((matches) => matches.length > 0));

/** Resolves an exact folder or ID first, then returns all eligible name matches for the caller to disambiguate. */
export const findRealmMatches = Effect.fnUntraced(function* (given: string, shouldRequireFolder: boolean) {
  const sql = yield* SqlClient.SqlClient;
  const wanted = given.trim();
  const [exact] = yield* sql<RealmMatch>`SELECT id, name, path FROM workspaces WHERE archived_at IS NULL
    AND (id = ${wanted} OR path = ${wanted}) AND (${shouldRequireFolder ? 1 : 0} = 0 OR path IS NOT NULL)`;
  if (exact !== undefined) return [exact];
  const matches = yield* listRealmCollisions(wanted);
  return shouldRequireFolder ? matches.filter((realm) => realm.path !== null) : matches;
});
