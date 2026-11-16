import { basename } from "node:path";
import type { CreateRealm, RealmCreation } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, realFolderOf } from "../core/index.ts";
import { changed, unchanged } from "./commands.ts";
import { findArchivedRealm } from "./realmLifecycle.ts";
import { createRealm } from "./workspaces.ts";

/** Checks recovery and name acknowledgement in the same transaction that creates the realm. */
export const createRealmOutcome = Effect.fn("createRealmOutcome")(function* (given: typeof CreateRealm.Type) {
  const sql = yield* SqlClient.SqlClient;
  const folder = given.path === null ? null : yield* realFolderOf(given.path);
  if (given.path !== null && folder === null) return yield* invalid(`No folder at ${given.path}.`);
  if (folder !== null) {
    const archived = yield* findArchivedRealm(folder);
    if (archived !== null) return unchanged<RealmCreation>({ _tag: "ArchivedMatch", archived });
  }
  const [existing] =
    folder === null ? [] : yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path = ${folder}`;
  const name = given.name.trim() || (folder === null ? "" : basename(folder));
  if (!given.allowDuplicateName) {
    const duplicates = yield* sql`SELECT id FROM workspaces WHERE archived_at IS NULL
      AND lower(name) = lower(${name}) AND id IS NOT ${existing?.id ?? null}`;
    if (duplicates.length > 0) return unchanged<RealmCreation>({ _tag: "NameTaken", name });
  }
  yield* createRealm(folder, name, given.crest, given.allowDuplicateName ?? false);
  return changed<RealmCreation>({ _tag: "Created" });
});
