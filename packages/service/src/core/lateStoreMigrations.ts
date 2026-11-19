import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** Attachments, Chronicler, backups, usage and prices, realms and Borderlands, and device pairing (0028 to 0044). */
export const lateStoreMigrations = {
  // Images attached to the owner's messages (message-attachments): `message_id` is null for a draft not yet sent.
  "0028_attachments": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE attachments (
      id TEXT PRIMARY KEY,
      file TEXT NOT NULL,
      name TEXT NOT NULL,
      media_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      message_id TEXT REFERENCES messages(id),
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE INDEX attachments_message ON attachments(message_id)`;
  }),
  // The Guildmaster (quest coordination): one hidden quest whose top thread the owner talks to, left out of every list.
  // `realm_path` is the realm the owner attached to a message for the Guildmaster; a suggestion keeps it for the quest
  // it may open.
  "0029_guildmaster": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN is_guildmaster INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE messages ADD COLUMN realm_path TEXT`;
    yield* sql`ALTER TABLE suggestions ADD COLUMN realm_path TEXT`;
  }),
  // Hearing back (quest coordination): the quests the Guildmaster opened, and the latest report it was told of each
  // (Reported, Attention, or Failed; null when none stands), so it hears of each change once.
  "0030_guildmaster_reports": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN opened_by_guildmaster INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE missions ADD COLUMN guildmaster_told TEXT`;
    // A card in the Guildmaster's conversation for a Ritual it created, not a quest it opened.
    yield* sql`ALTER TABLE suggestions ADD COLUMN is_ritual INTEGER NOT NULL DEFAULT 0`;
    // The tier the Guildmaster chose for the quest a suggestion may open (quest coordination, Opening a quest).
    yield* sql`ALTER TABLE suggestions ADD COLUMN tier TEXT`;
  }),
  // The Companions a thread falls back to after a failed turn, and how many the current failure chain has used (thread-panel).
  "0031_thread_backups": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN backups TEXT NOT NULL DEFAULT '[]'`;
    yield* sql`ALTER TABLE threads ADD COLUMN backup_step INTEGER NOT NULL DEFAULT 0`;
  }),
  // How each turn was billed (budget-control, Billing kind); null for turns recorded before, which keep counting by
  // whether they have a cost.
  "0032_usage_billing": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE usage ADD COLUMN billing TEXT`;
  }),
  // What each turn ran on and what it was estimated to cost, stamped when it ended and never changed (budget-control,
  // Estimated cost); the model price table, kept from the public table or the snapshot (decision record 0014).
  "0033_estimates_and_prices": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE usage ADD COLUMN harness TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN model TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN account_id TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN estimate REAL`;
    yield* sql`ALTER TABLE usage ADD COLUMN estimate_source TEXT`;
    yield* sql`ALTER TABLE usage ADD COLUMN priced_at INTEGER`;
    yield* sql`CREATE TABLE prices (
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input REAL NOT NULL,
      output REAL NOT NULL,
      cache_read REAL,
      cache_write REAL,
      source TEXT NOT NULL,
      fetched_at INTEGER NOT NULL,
      PRIMARY KEY (provider, model)
    )`;
  }),
  // A provider account's own budget or credits, and the stops it causes (budget-control, Account budgets and credits).
  // The account's id is empty for a harness's own sign-in on this computer.
  "0034_account_budgets": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE account_budgets (
      harness TEXT NOT NULL,
      account_id TEXT NOT NULL,
      cost REAL,
      tokens INTEGER,
      period TEXT,
      since INTEGER NOT NULL,
      last_change TEXT,
      PRIMARY KEY (harness, account_id)
    )`;
    yield* sql`ALTER TABLE budget_stops ADD COLUMN account_key TEXT`;
  }),
  // The plan limits a harness last reported for an account, kept so a reading outlives a restart (budget-control, Plan limits).
  "0035_plan_limits": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE plan_limits (
      account_key TEXT PRIMARY KEY,
      windows TEXT NOT NULL,
      read_at INTEGER NOT NULL
    )`;
  }),
  // What each agent reply's call used and its cost, for the line under it; a turn's use beyond its replies' calls is added to
  // its last reply when the turn ends, so the lines add up to the turn (budget-control, Seeing budget use and consumption).
  "0036_reply_usage": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE reply_usage (
      message_id TEXT PRIMARY KEY,
      input INTEGER NOT NULL,
      output INTEGER NOT NULL,
      cache_read INTEGER NOT NULL,
      cache_creation INTEGER NOT NULL,
      estimate REAL,
      reported REAL
    )`;
  }),
  // Free Realms (CHG-0149): realms tied to no folder, with a name and a crest; quests are placed in them later.
  "0037_free_realms": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE free_realms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      crest TEXT,
      created_at INTEGER NOT NULL
    )`;
  }),
  // Free Realm placement (mission-tracking): the Free Realm a quest is placed in, none for a realm's or a realmless quest.
  "0038_mission_free_realm": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN free_realm_id TEXT`;
  }),
  // Only Realms and Borderlands (CHG-0161): a realm is a `workspaces` row, tied to a folder or, with a null path, to
  // none; a quest with no realm is in the Borderlands. Free Realms are dropped without migrating them (owner's
  // decision, pre-release): their quests fall into the Borderlands. The table is rebuilt because SQLite cannot drop
  // NOT NULL. Foreign keys cannot be turned off inside the migration's transaction, so the threads' and permissions'
  // references are set aside while the old table is dropped, then put back on the rebuilt one.
  "0039_realms_and_borderlands": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TEMP TABLE kept_thread_realms AS
      SELECT id, workspace_id FROM threads WHERE workspace_id IS NOT NULL`;
    yield* sql`CREATE TEMP TABLE kept_permission_realms AS
      SELECT id, workspace_id FROM standing_permissions WHERE workspace_id IS NOT NULL`;
    yield* sql`UPDATE threads SET workspace_id = NULL WHERE workspace_id IS NOT NULL`;
    yield* sql`UPDATE standing_permissions SET workspace_id = NULL WHERE workspace_id IS NOT NULL`;
    yield* sql`CREATE TABLE realms_rebuilt (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT UNIQUE,
      created_at INTEGER NOT NULL,
      crest TEXT
    )`;
    yield* sql`INSERT INTO realms_rebuilt (id, name, path, created_at, crest)
      SELECT id, name, path, created_at, crest FROM workspaces`;
    yield* sql`DROP TABLE workspaces`;
    yield* sql`ALTER TABLE realms_rebuilt RENAME TO workspaces`;
    yield* sql`UPDATE threads SET workspace_id = (SELECT k.workspace_id FROM kept_thread_realms k WHERE k.id = threads.id)
      WHERE id IN (SELECT id FROM kept_thread_realms)`;
    yield* sql`UPDATE standing_permissions
      SET workspace_id = (SELECT k.workspace_id FROM kept_permission_realms k WHERE k.id = standing_permissions.id)
      WHERE id IN (SELECT id FROM kept_permission_realms)`;
    yield* sql`DROP TABLE kept_thread_realms`;
    yield* sql`DROP TABLE kept_permission_realms`;
    yield* sql`DROP TABLE free_realms`;
    yield* sql`ALTER TABLE missions DROP COLUMN free_realm_id`;
  }),
  // The runner a thread last ran on, kept from the owner's first change of runner until a turn starts: the handover
  // line is written then, for the runner that runs, and not at all when it is the same one (thread-handover, The line).
  "0040_handover_pending": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN handover_from TEXT`;
  }),
  // The assistant was renamed Iskios (CHG-0177): its stored quest and thread titles follow, once, here.
  "0041_assistant_renamed_iskios": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE missions SET title = 'Iskios' WHERE is_guildmaster = 1 AND title = 'Guildmaster'`;
    yield* sql`UPDATE threads SET title = 'Iskios'
      WHERE title = 'Guildmaster' AND mission_id IN (SELECT id FROM missions WHERE is_guildmaster = 1)`;
  }),
  // Where the owner had Iskios open from when they wrote to it (quest coordination, Context), as the line Iskios reads
  // with the message; null for every other message.
  "0042_message_viewing": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN viewing TEXT`;
  }),
  // Device pairing (device-pairing): this installation as a host (one identity, its pairing codes, its paired devices,
  // each kept only as the hash of its token) and as a controller (the hosts it is paired with, with the token each gave).
  "0043_device_pairing": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE host_identity (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      claim_secret TEXT NOT NULL,
      host_name TEXT,
      is_enabled INTEGER NOT NULL DEFAULT 0,
      public_key TEXT NOT NULL,
      relay_origin TEXT,
      room TEXT NOT NULL,
      secret_key TEXT NOT NULL
    )`;
    yield* sql`CREATE TABLE pairing_codes (
      id TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      secret_hash TEXT NOT NULL,
      used_at INTEGER
    )`;
    yield* sql`CREATE TABLE paired_devices (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      last_active_at INTEGER,
      name TEXT NOT NULL,
      paired_at INTEGER NOT NULL,
      token_hash TEXT NOT NULL
    )`;
    yield* sql`CREATE TABLE remote_hosts (
      id TEXT PRIMARY KEY,
      device_id TEXT NOT NULL,
      device_token TEXT NOT NULL,
      host_name TEXT NOT NULL,
      host_public_key TEXT NOT NULL,
      last_seen_at INTEGER,
      paired_at INTEGER NOT NULL,
      relay_origin TEXT NOT NULL,
      room TEXT NOT NULL
    )`;
  }),
  // A Ritual's reviewed scope (empty by default) and the service's marker for the message that starts a run.
  // The key keeps its first name: a development database already applied it (with an unused exact_target column).
  "0044_exact_action_authority": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE rituals ADD COLUMN authority TEXT NOT NULL DEFAULT '[]'`;
    yield* sql`CREATE TABLE ritual_run_messages (message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE, ritual_id TEXT NOT NULL REFERENCES rituals(id) ON DELETE CASCADE)`;
  }),
};
