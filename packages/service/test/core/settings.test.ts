import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { defaultSettings, readSettings } from "../../src/core/settings.ts";
import { migrations } from "../../src/core/store.ts";

// Reading the owner's saved settings (SP-A-07): what no longer decodes falls back field by field, and the approval
// level falls back to the stricter one, never to the looser default.

const directories: Array<string> = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

/** The settings read back after `stored` was written as the settings row, or after nothing was. */
const readStored = (stored: string | null) => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-settings-"));
  directories.push(directory);
  return Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* SqliteMigrator.run({ loader: SqliteMigrator.fromRecord(migrations) });
    if (stored !== null) yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${stored})`;
    return yield* readSettings;
  }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
};

describe("reading saved settings", () => {
  it.effect("reads the defaults when none are saved", () =>
    Effect.gen(function* () {
      expect(yield* readStored(null)).toEqual(defaultSettings);
    }),
  );

  it.effect("fills a setting added after the last save with its default and keeps the saved choices", () =>
    Effect.gen(function* () {
      const { shouldStreamReplies: _added, ...saved } = { ...defaultSettings, approvalLevel: "CommandsAndEdits" };
      expect(yield* readStored(JSON.stringify(saved))).toEqual({
        ...defaultSettings,
        approvalLevel: "CommandsAndEdits",
      });
    }),
  );

  it.effect("keeps every valid field when another no longer decodes", () =>
    Effect.gen(function* () {
      const stored = { ...defaultSettings, approvalLevel: "CommandsAndEdits", autoArchiveDays: 7, chatterThreshold: 1 };
      expect(yield* readStored(JSON.stringify(stored))).toEqual({
        ...defaultSettings,
        approvalLevel: "CommandsAndEdits",
        autoArchiveDays: 7,
      });
    }),
  );

  it.effect("falls back to the stricter approval level when the saved one is invalid", () =>
    Effect.gen(function* () {
      const stored = { ...defaultSettings, approvalLevel: "Everything", autoArchiveDays: 7 };
      const read = yield* readStored(JSON.stringify(stored));
      expect(read.approvalLevel).toBe("CommandsAndEdits");
      expect(read.autoArchiveDays).toBe(7);
    }),
  );

  it.effect("reads the stricter approval level and the other defaults from a row that is not an object", () =>
    Effect.gen(function* () {
      for (const stored of ["not json", "null", "[1]"]) {
        expect(yield* readStored(stored), stored).toEqual({ ...defaultSettings, approvalLevel: "CommandsAndEdits" });
      }
    }),
  );
});
