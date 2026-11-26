import { type LoreActor, type LoreHistoryKind, LoreKind, LoreOrigin, LoreScope } from "@outlore/contracts";
import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { type Fading, fadingStepsOf } from "./loreFading.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...).

// A lore entry's history (scoped-intel, History and undo): every save, replacement, change, widening, deletion,
// and fading step, with who or what made it and when, and each change's state before and after so it can
// be undone. The lore store (loreStore.ts) writes it; this module reads it.

const snapshotSchema = Schema.Struct({
  id: Schema.String,
  isPinned: Schema.Number,
  kind: LoreKind,
  lastUsedAt: Schema.Number,
  originEntry: Schema.NullOr(Schema.Number),
  originExcerpt: Schema.NullOr(Schema.String),
  originFrom: Schema.NullOr(Schema.String),
  originKind: Schema.NullOr(LoreOrigin.fields.kind),
  savedAt: Schema.Number,
  savedByThreadId: Schema.NullOr(Schema.String),
  savedByTitle: Schema.NullOr(Schema.String),
  scope: LoreScope,
  text: Schema.String,
  threadId: Schema.NullOr(Schema.String),
  updatedAt: Schema.Number,
  uses: Schema.Number,
  workspaceId: Schema.NullOr(Schema.String),
});

/** A lore entry's stored state, kept with each history entry so the owner can undo the change. */
export type Snapshot = typeof snapshotSchema.Type;

/** Who made a change: a thread, or the owner. */
export type Actor = { readonly kind: "Thread"; readonly threadId: string } | { readonly kind: "Owner" };

/** The owner, as the actor of a change. */
export const owner: Actor = { kind: "Owner" };
/** A thread, as the actor of a change. */
export const threadActor = (threadId: string): Actor => ({ kind: "Thread", threadId });

/** A lore entry's stored state, or null when it does not exist. */
export const readSnapshot = Effect.fnUntraced(function* (loreEntryId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<Snapshot>`
      SELECT id, scope, kind, thread_id AS threadId, workspace_id AS workspaceId, text,
        saved_by_thread_id AS savedByThreadId, saved_by_title AS savedByTitle, saved_at AS savedAt,
        updated_at AS updatedAt, last_used_at AS lastUsedAt, uses, is_pinned AS isPinned,
        origin_kind AS originKind, origin_entry AS originEntry, origin_from AS originFrom,
        origin_excerpt AS originExcerpt
      FROM intels WHERE id = ${loreEntryId}`;
  return row ?? null;
});

/** A fading step's identifier: one per lore entry, step, and time, so a step shown before it is stored keeps it. */
export const fadingEntryIdOf = (loreEntryId: string, kind: string, at: number) => `${loreEntryId}:${kind}:${at}`;

/** Whether an identifier names a fading step, which has no Undo. */
export const isFadingEntryId = (entryId: string) => /:(Dormant|Archived):\d+$/.test(entryId);

/** The fading steps a lore entry took since its last use and that are not stored yet. */
export const unrecordedStepsOf = Effect.fnUntraced(function* (state: Snapshot, fading: Fading) {
  const sql = yield* SqlClient.SqlClient;
  const steps = fadingStepsOf(state, fading);
  if (steps.length === 0) return [];
  const stored = yield* sql<{ id: string }>`SELECT id FROM intel_history
      WHERE id IN ${sql.in(steps.map((step) => fadingEntryIdOf(state.id, step.kind, step.at)))}`;
  return steps.filter((step) => !stored.some((row) => row.id === fadingEntryIdOf(state.id, step.kind, step.at)));
});

/** One stored history entry, its states still as JSON. */
export type EntryRow = {
  readonly actor: LoreActor;
  readonly actorTitle: string | null;
  readonly afterState: string | null;
  readonly approvedAt: number | null;
  readonly at: number;
  readonly beforeState: string | null;
  readonly id: string;
  readonly kind: LoreHistoryKind;
  readonly loreEntryId: string;
  readonly undid: LoreHistoryKind | null;
  readonly undoneAt: number | null;
};

const decodeSnapshot = Schema.decodeUnknownOption(Schema.fromJsonString(snapshotSchema));

/** A state stored as JSON, or null when there is none or it does not read as a lore entry's state. */
export const stateOf = (json: string | null): Snapshot | null =>
  json === null ? null : Option.getOrNull(decodeSnapshot(json));

/** Selects history entries; callers add the condition and order. */
export const selectEntries = (sql: SqlClient.SqlClient) => sql`
  SELECT id, intel_id AS loreEntryId, kind, actor, actor_title AS actorTitle, at, approved_at AS approvedAt,
    before_state AS beforeState, after_state AS afterState, undid, undone_at AS undoneAt
  FROM intel_history`;

/** One stored entry, or null when there is none with that identifier. */
export const readEntry = Effect.fnUntraced(function* (entryId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<EntryRow>`${selectEntries(sql)} WHERE id = ${entryId}`;
  return row === undefined ? null : { ...row, after: stateOf(row.afterState), before: stateOf(row.beforeState) };
});
