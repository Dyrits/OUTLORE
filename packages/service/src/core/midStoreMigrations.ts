import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** Budgets, scoped lore with its history, harnesses and accounts, handovers, and Rituals (0014 to 0027). */
export const midStoreMigrations = {
  // Budget control: each mission's limits, a turn's API-key cost, reached budgets, and budget lines.
  "0014_budgets": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN budget_cost REAL`;
    yield* sql`ALTER TABLE missions ADD COLUMN budget_tokens INTEGER`;
    // Null counts the turn's tokens as subscription spending.
    yield* sql`ALTER TABLE usage ADD COLUMN cost REAL`;
    // A null mission is the global budget; the holding thread carries no reference so a stop outlives it.
    yield* sql`CREATE TABLE budget_stops (
      id TEXT PRIMARY KEY,
      mission_id TEXT REFERENCES missions(id),
      thread_id TEXT NOT NULL,
      reached_at INTEGER NOT NULL,
      resolution TEXT,
      resolved_at INTEGER
    )`;
    yield* sql`CREATE TABLE budget_events (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL REFERENCES missions(id),
      text TEXT NOT NULL,
      at INTEGER NOT NULL
    )`;
  }),
  // Spending outlives the threads and missions that spent it (budget-control: lowering or deleting never
  // undoes spending): usage rows carry their own thread and end time, without references that a deletion breaks.
  "0015_lasting_spending": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE spending (
      turn_id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      ended_at INTEGER NOT NULL,
      input INTEGER NOT NULL,
      output INTEGER NOT NULL,
      cache_read INTEGER NOT NULL,
      cache_creation INTEGER NOT NULL,
      cost REAL
    )`;
    yield* sql`INSERT INTO spending (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, cost)
      SELECT u.turn_id, u.mission_id, t.thread_id, COALESCE(t.ended_at, t.started_at), u.input, u.output, u.cache_read,
        u.cache_creation, u.cost
      FROM usage u JOIN turns t ON t.id = u.turn_id`;
    yield* sql`DROP TABLE usage`;
    yield* sql`ALTER TABLE spending RENAME TO usage`;
    yield* sql`CREATE INDEX usage_mission ON usage (mission_id)`;
    yield* sql`CREATE INDEX usage_ended ON usage (ended_at)`;
  }),
  // Scoped intel: each intel at its scope, and each thread's change to intel, done or awaiting the owner.
  // The thread and workspace columns carry no reference: deleting a thread erases its intel explicitly.
  "0016_scoped_intel": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE intels (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      thread_id TEXT,
      workspace_id TEXT,
      text TEXT NOT NULL,
      saved_by_thread_id TEXT,
      saved_by_title TEXT,
      saved_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE INDEX intels_thread ON intels (thread_id)`;
    yield* sql`CREATE TABLE intel_changes (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      intel_id TEXT,
      scope TEXT NOT NULL,
      scope_thread_id TEXT,
      scope_workspace_id TEXT,
      text TEXT NOT NULL,
      previous_text TEXT,
      at INTEGER NOT NULL,
      resolved_at INTEGER
    )`;
    yield* sql`CREATE INDEX intel_changes_thread ON intel_changes (thread_id)`;
  }),
  "0017_intel_over_time": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Intel saved before kinds existed counts as a fact, last used when it was saved.
    yield* sql`ALTER TABLE intels ADD COLUMN kind TEXT NOT NULL DEFAULT 'Fact'`;
    yield* sql`ALTER TABLE intels ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE intels ADD COLUMN uses INTEGER NOT NULL DEFAULT 0`;
    yield* sql`ALTER TABLE intels ADD COLUMN last_used_at INTEGER NOT NULL DEFAULT 0`;
    yield* sql`UPDATE intels SET last_used_at = saved_at`;
    yield* sql`ALTER TABLE intel_changes ADD COLUMN intel_kind TEXT NOT NULL DEFAULT 'Fact'`;
  }),
  // What an intel rests on (scoped-intel, Saving), copied when saved so it outlives the entry's or message's
  // thread; a global save awaiting approval carries it until approved. Intel saved before has none.
  "0018_intel_origins": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    for (const table of ["intels", "intel_changes"]) {
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_kind TEXT`;
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_entry INTEGER`;
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_from TEXT`;
      yield* sql`ALTER TABLE ${sql(table)} ADD COLUMN origin_excerpt TEXT`;
    }
  }),
  // An intel's history (scoped-intel, History and undo): each entry keeps the intel's state before and after,
  // as JSON, so the owner can undo it. Intel saved before starts its history with one save.
  "0019_intel_history": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE intel_history (
      id TEXT PRIMARY KEY,
      intel_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      actor TEXT NOT NULL,
      actor_thread_id TEXT,
      actor_title TEXT,
      at INTEGER NOT NULL,
      approved_at INTEGER,
      before_state TEXT,
      after_state TEXT,
      scope_thread_id TEXT,
      undid TEXT,
      undo_of TEXT,
      undone_at INTEGER
    )`;
    yield* sql`CREATE INDEX intel_history_intel ON intel_history (intel_id)`;
    const rows = yield* sql<{
      id: string;
      savedAt: number;
      savedByThreadId: string | null;
      savedByTitle: string | null;
      state: string;
      threadId: string | null;
    }>`
      SELECT id, saved_at AS savedAt, saved_by_thread_id AS savedByThreadId, saved_by_title AS savedByTitle,
        thread_id AS threadId,
        json_object('id', id, 'scope', scope, 'kind', kind, 'threadId', thread_id, 'workspaceId', workspace_id,
          'text', text, 'savedByThreadId', saved_by_thread_id, 'savedByTitle', saved_by_title,
          'savedAt', saved_at, 'updatedAt', updated_at, 'lastUsedAt', last_used_at, 'uses', uses,
          'isPinned', is_pinned, 'originKind', origin_kind, 'originEntry', origin_entry,
          'originFrom', origin_from, 'originExcerpt', origin_excerpt) AS state
      FROM intels`;
    for (const row of rows) {
      yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, actor_thread_id, actor_title, at, after_state,
          scope_thread_id)
        VALUES (${crypto.randomUUID()}, ${row.id}, 'Saved', ${row.savedByThreadId === null ? "Owner" : "Thread"},
          ${row.savedByThreadId}, ${row.savedByTitle}, ${row.savedAt}, ${row.state}, ${row.threadId})`;
    }
  }),
  // Widening and narrowing proposed from evidence (scoped-intel): each use with the using thread's workspace,
  // and the owner's decisions on proposals, which are otherwise worked out when read. Earlier uses have none.
  "0020_intel_proposals": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE intel_uses (
      intel_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      workspace_id TEXT
    )`;
    yield* sql`CREATE INDEX intel_uses_intel ON intel_uses (intel_id, at)`;
    yield* sql`CREATE TABLE intel_proposal_decisions (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      at INTEGER NOT NULL
    )`;
  }),
  // Each thread's harness and provider account (provider-accounts); earlier threads ran on Claude Code with
  // the computer's own sign-in. Accounts added in Outlore keep their folders beside the database.
  "0021_harnesses_and_accounts": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN harness TEXT NOT NULL DEFAULT 'claude'`;
    yield* sql`ALTER TABLE threads ADD COLUMN account_id TEXT`;
    yield* sql`CREATE TABLE accounts (
      id TEXT PRIMARY KEY,
      harness TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`;
  }),
  // What a thread's context held after its latest model call in each turn, for the context gauge
  // (thread-panel); earlier turns did not record it.
  "0022_usage_context": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE usage ADD COLUMN context INTEGER`;
  }),
  // A realm's crest, designed by the owner: JSON, null until then (the quests of a realm wear it).
  "0023_realm_crest": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE workspaces ADD COLUMN crest TEXT`;
  }),
  // The model that wrote each agent reply, as the harness named it, for the Companion label; null when unreported.
  "0024_message_model": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN model TEXT`;
  }),
  // The lines recording a thread's handovers (thread-handover): a change of its harness, account, model, or effort.
  "0025_handovers": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE handovers (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      text TEXT NOT NULL,
      at INTEGER NOT NULL
    )`;
  }),
  // The harness that wrote each agent reply, so a handover leaves earlier replies under their own provider. A thread
  // could not change harness or model before, so each earlier reply is the thread's own; a reply that named no model
  // (before 0024, or a harness that names none) takes the model the thread chose.
  "0026_message_harness": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN harness TEXT`;
    yield* sql`UPDATE messages SET harness = (SELECT harness FROM threads WHERE threads.id = messages.thread_id)
      WHERE sender_kind = 'agent'`;
    yield* sql`UPDATE messages SET model = (SELECT model FROM threads WHERE threads.id = messages.thread_id)
      WHERE sender_kind = 'agent' AND model IS NULL
        AND (SELECT model FROM threads WHERE threads.id = messages.thread_id) != 'default'`;
  }),
  // A Ritual: an instruction on a schedule in a quest of its own (rituals). Schedule, primary Companion, and fallbacks
  // are stored as JSON; `last_run_state` is Underway, Done, Interrupted, or Failed, null before the first run, and
  // `fallback_step` counts the fallbacks the current run has used.
  "0027_rituals": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE rituals (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL UNIQUE REFERENCES missions(id),
      instruction TEXT NOT NULL,
      schedule TEXT NOT NULL,
      primary_companion TEXT NOT NULL,
      fallbacks TEXT NOT NULL,
      is_on INTEGER NOT NULL DEFAULT 1,
      next_run_at INTEGER,
      last_run_at INTEGER,
      last_run_state TEXT,
      fallback_step INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    )`;
  }),
};
