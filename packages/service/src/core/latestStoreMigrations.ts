import { realmSlugOf } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** Additive latest migrations, kept apart from earlier schema batches to keep each file readable. */
export const latestStoreMigrations = {
  // An agent-authored anchor reply retains the message that prompted it.
  "0064_message_reply_to": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN reply_to_message_id TEXT`;
    yield* sql`ALTER TABLE suggestions ADD COLUMN proposal_message_id TEXT`;
  }),
  "0065_chronicler_channels": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN chronicler_channel TEXT`;
    yield* sql`ALTER TABLE messages ADD COLUMN is_conversation_only INTEGER NOT NULL DEFAULT 0`;
    yield* sql`CREATE UNIQUE INDEX missions_chronicler_channel ON missions (chronicler_channel) WHERE chronicler_channel IS NOT NULL`;
  }),
  // 0064 and 0065 each gained a column after a development store had recorded them, and a recorded migration is not run again.
  // Each column is added only where it is missing, so a store that ran the migrations in their final form is untouched.
  "0066_repair_pane_columns": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const has = (table: string, column: string) =>
      sql<{ name: string }>`SELECT name FROM pragma_table_info(${table}) WHERE name = ${column}`.pipe(
        Effect.map((rows) => rows.length > 0),
      );
    if (!(yield* has("messages", "is_conversation_only")))
      yield* sql`ALTER TABLE messages ADD COLUMN is_conversation_only INTEGER NOT NULL DEFAULT 0`;
    if (!(yield* has("suggestions", "proposal_message_id")))
      yield* sql`ALTER TABLE suggestions ADD COLUMN proposal_message_id TEXT`;
  }),
  // CHG-0599: a status and its displayed name are one word.
  "0067_status_names": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Underway' WHERE state = 'Running'`;
    yield* sql`UPDATE threads SET state = 'Resting' WHERE state = 'Idle'`;
    yield* sql`UPDATE threads SET state = 'Fulfilled' WHERE state = 'Done'`;
    yield* sql`UPDATE missions SET ending = 'Fulfilled' WHERE ending = 'Done'`;
  }),
  // The Chronicle's unread (CHG-0569, conversation-panes): when the owner last read a thread's conversation.
  "0068_thread_reads": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE thread_reads (
      thread_id TEXT PRIMARY KEY REFERENCES threads(id) ON DELETE CASCADE,
      read_at INTEGER NOT NULL
    )`;
    yield* sql`INSERT INTO thread_reads (thread_id, read_at)
      SELECT t.id, m.last_activity_at FROM threads t JOIN missions m ON m.id = t.mission_id`;
  }),
  // A quest's realm changes have no place of their own, yet History shows them as routine events (CHG-0569): one row per move, naming where the quest came from and went.
  "0069_quest_moves": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE quest_moves (
      id TEXT NOT NULL,
      mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
      from_workspace_id TEXT,
      to_workspace_id TEXT,
      at INTEGER NOT NULL,
      PRIMARY KEY (mission_id, id)
    )`;
  }),
  "0070_thread_permission_mode": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN permission_mode TEXT
      CHECK (permission_mode IN ('Supervised', 'AutoAcceptEdits', 'Auto', 'FullAccess'))`;
  }),
  // CHG-0617: the two Workshop approval levels and the sandbox-escape toggle fold into the four permission modes, so the Workshop's row becomes the default mode every thread without an override runs with.
  "0071_settings_permission_mode": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE settings SET value = json_remove(
        json_set(value, '$.defaultPermissionMode', CASE
          WHEN json_extract(value, '$.approvalLevel') = 'CommandsAndEdits' THEN 'Supervised'
          WHEN json_extract(value, '$.shouldAllowOutsideSandbox') = 1 THEN 'FullAccess'
          ELSE 'Auto'
        END),
        '$.approvalLevel', '$.shouldAllowOutsideSandbox')
      WHERE key = 'settings' AND json_type(value, '$.defaultPermissionMode') IS NULL`;
  }),
  // CHG-0617: a turn is admitted with the effective permission mode it then runs under, so an owner's change during the turn leaves the running turn alone and applies from the next one.
  "0072_turn_permission_mode": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE turns ADD COLUMN permission_mode TEXT
      CHECK (permission_mode IN ('Supervised', 'AutoAcceptEdits', 'Auto', 'FullAccess'))`;
  }),
  // A Ritual is an entity of its realm instead of a quest of its own (CHG-0616): the quest it was opened from, kept as the visible origin link on the Ritual's card and panel.
  "0073_ritual_origin_mission": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE rituals ADD COLUMN origin_mission_id TEXT`;
  }),
  // Where the thread's tool calls last moved its shell (conversation-terminal, Starting folder): a candidate path, checked against the disk and the workspace whenever the thread is read.
  "0075_thread_working_folder": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN working_folder TEXT`;
  }),
  // A realm's name is written like a Slack channel (lowercase words joined by hyphens), and `#` names it in a message.
  "0076_realm_slug_names": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const realms = yield* sql<{ id: string; name: string }>`SELECT id, name FROM workspaces`;
    for (const realm of realms) {
      const slug = realmSlugOf(realm.name);
      if (slug !== "" && slug !== realm.name) yield* sql`UPDATE workspaces SET name = ${slug} WHERE id = ${realm.id}`;
    }
  }),
  // Whether the owner also sent a message to the parent ("Also send to"), as the scope they chose; null otherwise.
  "0078_message_sent_to_parent": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE messages ADD COLUMN sent_to_parent TEXT`;
  }),
  // Word search over message text (`read_parent_messages`): an external-content full-text index, kept current by triggers.
  "0079_message_search": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* Effect.gen(function* () {
      yield* sql`CREATE VIRTUAL TABLE messages_fts USING fts5(text, content = 'messages', content_rowid = 'rowid', tokenize = 'porter unicode61 remove_diacritics 2')`;
      yield* sql`CREATE TRIGGER messages_fts_insert AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts (rowid, text) VALUES (new.rowid, new.text);
      END`;
      yield* sql`CREATE TRIGGER messages_fts_delete AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts (messages_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
      END`;
      yield* sql`CREATE TRIGGER messages_fts_update AFTER UPDATE OF text ON messages BEGIN
        INSERT INTO messages_fts (messages_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
        INSERT INTO messages_fts (rowid, text) VALUES (new.rowid, new.text);
      END`;
      yield* sql`INSERT INTO messages_fts (messages_fts) VALUES ('rebuild')`;
    }).pipe(Effect.ignore);
  }),
  // The opener's latest messages a thread the owner opened reads on its first turn, captured when it was opened.
  "0080_thread_opener_tail": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN opener_tail TEXT`;
  }),
  // API key accounts (provider-accounts): the provider an account's key is for and the models the owner named for it,
  // as a JSON array; both null for a sign-in account. The key itself is in the Vault, never in the store.
  "0081_key_accounts": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE accounts ADD COLUMN key_provider TEXT`;
    yield* sql`ALTER TABLE accounts ADD COLUMN key_models TEXT`;
  }),
  // The Companion mention (thread-messaging, Mentioning a Companion with @; CHG-0781): a Companion the owner asks by
  // name answers in a thread of its own, the top thread of a hidden quest (`is_companion`), found per conversation and
  // model in `companion_threads`; one row of `companion_exchanges` per message that asked it. Nothing is rewritten.
  "0082_companion_mentions": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE missions ADD COLUMN is_companion INTEGER NOT NULL DEFAULT 0`;
    yield* sql`CREATE TABLE companion_threads (
      parent_thread_id TEXT NOT NULL REFERENCES threads(id),
      harness TEXT NOT NULL,
      account_key TEXT NOT NULL,
      model TEXT NOT NULL,
      thread_id TEXT NOT NULL UNIQUE REFERENCES threads(id),
      mission_id TEXT NOT NULL REFERENCES missions(id),
      last_seen_message_id TEXT,
      PRIMARY KEY (parent_thread_id, harness, account_key, model)
    )`;
    yield* sql`CREATE TABLE companion_exchanges (
      id TEXT PRIMARY KEY,
      parent_thread_id TEXT NOT NULL REFERENCES threads(id),
      companion_thread_id TEXT NOT NULL REFERENCES threads(id),
      owner_message_id TEXT NOT NULL,
      prompt_message_id TEXT,
      reply_message_id TEXT,
      state TEXT NOT NULL,
      context_turn_id TEXT,
      asked_at INTEGER NOT NULL
    )`;
    yield* sql`CREATE INDEX companion_exchanges_companion ON companion_exchanges (companion_thread_id, state)`;
    yield* sql`CREATE INDEX companion_exchanges_parent ON companion_exchanges (parent_thread_id, state)`;
  }),
  // Framed Companion follow-ups and opt-in context sharing (thread-messaging, CHG-0787): exchanges in a side
  // conversation share one `frame_message_id` and stay out of the main Companion's context until `is_context_shared` is set.
  "0083_companion_frames": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE companion_exchanges ADD COLUMN frame_message_id TEXT`;
    yield* sql`ALTER TABLE companion_exchanges ADD COLUMN is_context_shared INTEGER NOT NULL DEFAULT 0`;
    yield* sql`UPDATE companion_exchanges SET is_context_shared = 1 WHERE context_turn_id IS NOT NULL`;
    yield* sql`CREATE INDEX companion_exchanges_frame ON companion_exchanges (parent_thread_id, frame_message_id)`;
  }),
};
