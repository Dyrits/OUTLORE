import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { Layer } from "effect";
import { earlyStoreMigrations } from "./earlyStoreMigrations.ts";
import { lateStoreMigrations } from "./lateStoreMigrations.ts";
import { midStoreMigrations } from "./midStoreMigrations.ts";
import { recentStoreMigrations } from "./recentStoreMigrations.ts";

/** Every schema change, in order; exported so a test can stop before one and check it on existing data. */
export const migrations = {
  ...earlyStoreMigrations,
  ...midStoreMigrations,
  ...lateStoreMigrations,
  ...recentStoreMigrations,
};

/** The service's one SQLite database, migrated before use. */
export const storeLayer = (filename: string) =>
  Layer.effectDiscard(SqliteMigrator.run({ loader: SqliteMigrator.fromRecord(migrations) })).pipe(
    Layer.provideMerge(SqliteClient.layer({ filename })),
  );
