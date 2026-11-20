import { Effect } from "effect";
import { SqlClient } from "effect/sql";

/** Additive recent migrations, kept apart from the historical schema to keep it readable. */
export const recentStoreMigrations = {
  "0045_own_account_labels": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE own_account_labels (harness TEXT PRIMARY KEY, label TEXT NOT NULL)`;
  }),
  "0046_realm_archives": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE workspaces ADD COLUMN archived_at INTEGER`;
    // Only quests archived with the realm are restored with it; earlier individual archives stay archived.
    yield* sql`CREATE TABLE realm_archived_quests (
      workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      mission_id TEXT PRIMARY KEY REFERENCES missions(id) ON DELETE CASCADE,
      previous_ending TEXT
    )`;
  }),
  "0047_thread_activities": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // The tool calls a harness reported, by the harness's own id. A call that also reached the permission prompt is
    // marked, so the thread shows it once, as its action (action-approval, What a working thread is doing).
    yield* sql`CREATE TABLE thread_activities (
      id TEXT NOT NULL,
      thread_id TEXT NOT NULL REFERENCES threads(id),
      at INTEGER NOT NULL,
      summary TEXT NOT NULL,
      detail TEXT NOT NULL,
      is_prompted INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (thread_id, id)
    )`;
    yield* sql`CREATE INDEX thread_activities_by_thread ON thread_activities (thread_id, at)`;
  }),
  "0048_turn_harness": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // The harness a turn was admitted on, which keeps its permission authority when the owner picks another harness
    // during it (thread-handover). Turns admitted before this change fall back to the thread's harness.
    yield* sql`ALTER TABLE turns ADD COLUMN harness TEXT`;
  }),
  "0049_suggested_messages": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // The owner messages that carry a suggestion's text, written by an agent and only routed by the owner: never the
    // owner's own words for structural authority (mission-coordination, audit SA-06). The mark lives as long as the
    // message, whatever becomes of the suggestion or the thread that wrote it.
    yield* sql`CREATE TABLE suggested_messages (message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE)`;
  }),
  // The assistant was renamed Chronicler when the app became Outlore: its stored quest and thread titles follow, once.
  "0050_assistant_renamed_chronicler": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE missions SET title = 'Chronicler' WHERE is_guildmaster = 1 AND title = 'Iskios'`;
    yield* sql`UPDATE threads SET title = 'Chronicler'
      WHERE title = 'Iskios' AND mission_id IN (SELECT id FROM missions WHERE is_guildmaster = 1)`;
  }),
  // Choice questions (CHG-0299): the questions a thread asks the owner to choose answers to, and the answers, both JSON.
  "0051_choice_questions": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE questions ADD COLUMN choices TEXT`;
    yield* sql`ALTER TABLE questions ADD COLUMN answers TEXT`;
  }),
  "0052_question_kind": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE questions ADD COLUMN kind TEXT NOT NULL DEFAULT 'Confirmation'`;
    yield* sql`UPDATE questions SET kind = CASE WHEN choices IS NOT NULL THEN 'Choice'
      WHEN pattern IS NOT NULL AND permission IS NOT NULL THEN 'Approval' ELSE 'Confirmation' END`;
  }),
  "0053_command_outcome_wakes": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Null marks older value-only rows, decoded on replay without rewriting the saved value.
    yield* sql`ALTER TABLE command_outcomes ADD COLUMN wakes TEXT`;
    yield* sql`ALTER TABLE command_outcomes ADD COLUMN thread_id TEXT`;
    yield* sql`CREATE INDEX command_outcomes_by_thread ON command_outcomes (thread_id)`;
  }),
  "0055_lore_change_previous_placement": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    // Older pending changes have no reliable snapshot; do not infer one from a target that may have changed.
    yield* sql`ALTER TABLE intel_changes ADD COLUMN previous_scope TEXT`;
    yield* sql`ALTER TABLE intel_changes ADD COLUMN previous_thread_id TEXT`;
    yield* sql`ALTER TABLE intel_changes ADD COLUMN previous_workspace_id TEXT`;
    yield* sql`ALTER TABLE intel_changes ADD COLUMN previous_kind TEXT`;
  }),
  // Own copy (workspace-attachment, CHG-0441): the git worktree a thread works in and its branch, made for it or
  // inherited from its parent; null for a thread that works in its workspace's folder. 0054 is taken by another branch.
  "0056_thread_own_copy": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN own_copy TEXT`;
    yield* sql`ALTER TABLE threads ADD COLUMN own_copy_branch TEXT`;
  }),
  // The order the owner gave the realms by dragging them in the sidebar; null until one is placed, after those that are.
  "0057_realm_order": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE workspaces ADD COLUMN position INTEGER`;
  }),
  // The context window the turn's harness reported for its model (thread-panel, The context gauge; CHG-0509); null for a
  // turn whose harness reported none, and for every turn before this, which keep the fallback.
  "0058_usage_context_window": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE usage ADD COLUMN context_window INTEGER`;
    yield* sql`CREATE INDEX usage_by_model_window ON usage (model, ended_at) WHERE context_window IS NOT NULL`;
  }),
  // An errand the owner archived on its own, with the errands beneath it: when, or null while it is in the lists (thread-tree).
  "0059_thread_archived": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN archived_at INTEGER`;
  }),
  // The model a turn was admitted on, kept as its harness is (0048), so a working thread shows the Companion that runs
  // it while the owner picks another during the turn (thread-handover). Turns before this change fall back to the thread's.
  "0060_turn_model": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE turns ADD COLUMN model TEXT`;
  }),
  // The diff of a call that modified a file (action-approval, A modified file's diff): its counts, the changed text cut
  // at a size limit, and a note when it was cut or is not known. Only the diff is kept, never a whole file; the text is
  // the last column, so the steps list reads the counts without it. Deleted with the thread.
  "0061_thread_activity_diffs": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE thread_activity_diffs (
      thread_id TEXT NOT NULL REFERENCES threads(id),
      activity_id TEXT NOT NULL,
      added INTEGER,
      removed INTEGER,
      note TEXT,
      text TEXT NOT NULL,
      PRIMARY KEY (thread_id, activity_id)
    )`;
  }),
  // Connectors (connectors blueprint, Stored choices): the installed connectors with their global switch, the explicit choices
  // of a realm, the Borderlands and a quest (Inherit is no row; a deleted realm or quest takes its rows with it), and the
  // tools switched off (on is no row). `is_removing` marks the first of a removal's three steps.
  "0062_connectors": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`CREATE TABLE connectors (
      id TEXT PRIMARY KEY,
      installed_at INTEGER NOT NULL,
      is_enabled INTEGER NOT NULL DEFAULT 1,
      is_removing INTEGER NOT NULL DEFAULT 0,
      options TEXT NOT NULL DEFAULT '{}',
      needs TEXT
    )`;
    yield* sql`CREATE TABLE connector_choices (
      connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
      mission_id TEXT REFERENCES missions(id) ON DELETE CASCADE,
      choice TEXT NOT NULL
    )`;
    yield* sql`CREATE UNIQUE INDEX connector_choices_borderlands ON connector_choices (connector_id) WHERE kind = 'Borderlands'`;
    yield* sql`CREATE UNIQUE INDEX connector_choices_realm ON connector_choices (connector_id, workspace_id) WHERE kind = 'Realm'`;
    yield* sql`CREATE UNIQUE INDEX connector_choices_quest ON connector_choices (connector_id, mission_id) WHERE kind = 'Quest'`;
    yield* sql`CREATE TABLE connector_tools (
      connector_id TEXT NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
      tool TEXT NOT NULL,
      PRIMARY KEY (connector_id, tool)
    )`;
  }),
  // Where a thread hangs from (conversation panes): the message of the conversation it came out of. Old rows have none.
  // A message has at most one thread hanging from it, which the index keeps.
  "0063_thread_anchors": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`ALTER TABLE threads ADD COLUMN anchor_message_id TEXT`;
    yield* sql`CREATE UNIQUE INDEX threads_anchor_message ON threads (anchor_message_id) WHERE anchor_message_id IS NOT NULL`;
  }),
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
  // 0064 and 0065 each gained a column after a development store had recorded them, and a recorded migration is not run
  // again: that store had no `messages.is_conversation_only` or `suggestions.proposal_message_id`, so reading a quest
  // failed ("no such column") and its panes drew nothing. Each column is added only where it is missing, so a store
  // that ran the migrations in their final form is untouched.
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
  // CHG-0599: a status and its displayed name are one word. Running becomes Underway, Idle Resting (the owner's turn),
  // and Done Fulfilled, for a thread's state and a mission's ending; a Ritual's run state keeps its own words.
  "0067_status_names": Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`UPDATE threads SET state = 'Underway' WHERE state = 'Running'`;
    yield* sql`UPDATE threads SET state = 'Resting' WHERE state = 'Idle'`;
    yield* sql`UPDATE threads SET state = 'Fulfilled' WHERE state = 'Done'`;
    yield* sql`UPDATE missions SET ending = 'Fulfilled' WHERE ending = 'Done'`;
  }),
};
