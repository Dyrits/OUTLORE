import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { migrations } from "../../src/core/store.ts";

// The store's migrations on a database that already holds data, as the owner's does.

const directories: Array<string> = [];
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const migrateUntil = (last: string) =>
  SqliteMigrator.run({
    loader: SqliteMigrator.fromRecord(Object.fromEntries(Object.entries(migrations).filter(([id]) => id <= last))),
  });

describe("migrating pending lore changes", () => {
  it.effect("keeps old proposals and leaves their unknown target state unset", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0053_command_outcome_wakes");
      yield* sql`INSERT INTO intel_changes (id, thread_id, kind, status, intel_id, scope, text, previous_text, at)
        VALUES ('c', 't', 'Update', 'Awaiting', 'l', 'Global', 'New', 'Old', 1)`;
      yield* migrateUntil("0055_lore_change_previous_placement");
      expect(
        yield* sql`SELECT status, text, previous_text AS previousText, previous_scope AS previousScope,
        previous_thread_id AS previousThreadId, previous_workspace_id AS previousWorkspaceId, previous_kind AS previousKind
        FROM intel_changes WHERE id = 'c'`,
      ).toEqual([
        {
          previousKind: null,
          previousScope: null,
          previousText: "Old",
          previousThreadId: null,
          previousWorkspaceId: null,
          status: "Awaiting",
          text: "New",
        },
      ]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});

describe("migrating usage to record the context window", () => {
  it.effect("keeps old usage rows, whose window no harness reported, with no window", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0057_realm_order");
      yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, context, model)
        VALUES ('turn', 'mission', 'thread', 1, 10, 5, 0, 0, 15, 'claude-sonnet-5-5')`;
      yield* migrateUntil("0058_usage_context_window");
      yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, context, model, context_window)
        VALUES ('later', 'mission', 'thread', 2, 10, 5, 0, 0, 15, 'claude-sonnet-5-5', 1000000)`;
      expect(
        yield* sql`SELECT turn_id AS turn, context, context_window AS contextWindow FROM usage ORDER BY ended_at`,
      ).toEqual([
        { context: 15, contextWindow: null, turn: "turn" },
        { context: 15, contextWindow: 1_000_000, turn: "later" },
      ]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});

describe("migrating saved realms to archive support", () => {
  it.effect("reads a realm saved before archive support as active without rewriting it", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0045_own_account_labels");
      yield* sql`INSERT INTO workspaces (id, name, path, created_at, crest) VALUES ('garden', 'Garden', '/garden', 1, NULL)`;
      yield* migrateUntil("0046_realm_archives");
      expect(yield* sql`SELECT id, name, path, archived_at AS archivedAt FROM workspaces`).toEqual([
        { archivedAt: null, id: "garden", name: "Garden", path: "/garden" },
      ]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});

describe("only Realms and Borderlands (CHG-0161)", () => {
  it.effect("keeps realms and their threads, lets a realm have no folder, and drops Free Realms", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0038_mission_free_realm");
      yield* sql`INSERT INTO workspaces (id, name, path, created_at, crest) VALUES ('w1', 'App', '/app', 1, NULL)`;
      yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at, free_realm_id)
        VALUES ('m1', 't1', 'Quest', 1, 1, NULL)`;
      yield* sql`INSERT INTO threads (id, mission_id, state, harness, model, workspace_id, title)
        VALUES ('t1', 'm1', 'Idle', 'ClaudeCode', 'default', 'w1', 'Quest')`;
      yield* sql`INSERT INTO free_realms (id, name, crest, created_at) VALUES ('f1', 'Garden', NULL, 1)`;

      yield* migrateUntil("0039_realms_and_borderlands");

      const [thread] = yield* sql<{ path: string }>`
        SELECT w.path FROM threads t JOIN workspaces w ON w.id = t.workspace_id WHERE t.id = 't1'`;
      expect(thread?.path).toBe("/app");
      yield* sql`INSERT INTO workspaces (id, name, path, created_at) VALUES ('w2', 'Ideas', NULL, 2)`;
      yield* sql`INSERT INTO workspaces (id, name, path, created_at) VALUES ('w3', 'Notes', NULL, 3)`;
      expect(yield* sql<{ id: string }>`SELECT id FROM workspaces WHERE path IS NULL ORDER BY id`).toEqual([
        { id: "w2" },
        { id: "w3" },
      ]);
      const tables = yield* sql<{ name: string }>`SELECT name FROM sqlite_master WHERE name = 'free_realms'`;
      expect(tables).toEqual([]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});

describe("the assistant renamed Iskios (CHG-0177)", () => {
  it.effect("renames the stored titles of the assistant's quest and thread, and no other", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0040_handover_pending");
      yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at, is_guildmaster)
        VALUES ('g', 'gt', 'Guildmaster', 1, 1, 1), ('q', 'qt', 'Guildmaster', 1, 1, 0)`;
      yield* sql`INSERT INTO threads (id, mission_id, state, harness, model, title)
        VALUES ('gt', 'g', 'Idle', 'ClaudeCode', 'default', 'Guildmaster'), ('qt', 'q', 'Idle', 'ClaudeCode', 'default', 'Guildmaster')`;

      yield* migrateUntil("0041_assistant_renamed_iskios");

      const titles = yield* sql<{ id: string; title: string }>`
        SELECT id, title FROM missions UNION ALL SELECT id, title FROM threads ORDER BY id`;
      expect(titles).toEqual([
        { id: "g", title: "Iskios" },
        { id: "gt", title: "Iskios" },
        { id: "q", title: "Guildmaster" },
        { id: "qt", title: "Guildmaster" },
      ]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});

describe("the assistant renamed Chronicler (CHG-0285)", () => {
  it.effect("renames the stored titles of the assistant's quest and thread, and no other", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0049_suggested_messages");
      yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at, is_guildmaster)
        VALUES ('g', 'gt', 'Iskios', 1, 1, 1), ('q', 'qt', 'Iskios', 1, 1, 0)`;
      yield* sql`INSERT INTO threads (id, mission_id, state, harness, model, title)
        VALUES ('gt', 'g', 'Idle', 'ClaudeCode', 'default', 'Iskios'), ('qt', 'q', 'Idle', 'ClaudeCode', 'default', 'Iskios')`;

      yield* migrateUntil("0050_assistant_renamed_chronicler");

      const titles = yield* sql<{ id: string; title: string }>`
        SELECT id, title FROM missions UNION ALL SELECT id, title FROM threads ORDER BY id`;
      expect(titles).toEqual([
        { id: "g", title: "Chronicler" },
        { id: "gt", title: "Chronicler" },
        { id: "q", title: "Iskios" },
        { id: "qt", title: "Iskios" },
      ]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});

describe("migrating saved questions to explicit kinds", () => {
  it.effect("preserves past answers and classifies choices, grants and confirmations", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-store-"));
    directories.push(directory);
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* migrateUntil("0051_choice_questions");
      yield* sql`INSERT INTO missions (id, top_thread_id, title, created_at, last_activity_at) VALUES ('m', 't', 'Quest', 1, 1)`;
      yield* sql`INSERT INTO threads (id, mission_id, state) VALUES ('t', 'm', 'Idle')`;
      for (const [id, pattern, permission, choices] of [
        ["action", "git push", "Run this exact command", null],
        ["choice", null, null, "[]"],
        ["confirmation", null, null, null],
      ]) {
        yield* sql`INSERT INTO questions (id, mission_id, thread_id, source, summary, details, pattern, permission, choices, asked_at, outcome)
          VALUES (${id}, 'm', 't', 'Thread', 'Question', 'Details', ${pattern}, ${permission}, ${choices}, 1, 'Withdrawn')`;
      }
      yield* migrateUntil("0052_question_kind");
      expect(yield* sql`SELECT id, kind, outcome FROM questions ORDER BY id`).toEqual([
        { id: "action", kind: "Approval", outcome: "Withdrawn" },
        { id: "choice", kind: "Choice", outcome: "Withdrawn" },
        { id: "confirmation", kind: "Confirmation", outcome: "Withdrawn" },
      ]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: join(directory, "store.sqlite") })));
  });
});
