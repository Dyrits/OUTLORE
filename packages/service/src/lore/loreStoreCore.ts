import type { LoreHistoryKind } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { newId } from "../core/index.ts";
import { readFading } from "./loreFading.ts";
import { type Actor, fadingEntryIdOf, readSnapshot, type Snapshot, unrecordedStepsOf } from "./loreHistory.ts";

// Low-level lore storage primitives shared by entry mutations and maintenance operations.

/** One history entry to append for a lore entry change. */
export type EntryRecord = {
  readonly actor: Actor;
  readonly after: Snapshot | null;
  readonly approvedAt: number | null;
  readonly before: Snapshot | null;
  readonly kind: LoreHistoryKind;
  readonly loreEntryId: string;
  readonly undid: { readonly id: string; readonly kind: LoreHistoryKind } | null;
};

/** Stores a lore entry's state, creating or overwriting it. */
export const writeSnapshot = Effect.fnUntraced(function* (state: Snapshot) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`INSERT OR REPLACE INTO intels (id, scope, kind, thread_id, workspace_id, text, saved_by_thread_id,
      saved_by_title, saved_at, updated_at, last_used_at, uses, is_pinned, origin_kind, origin_entry, origin_from,
      origin_excerpt)
    VALUES (${state.id}, ${state.scope}, ${state.kind}, ${state.threadId}, ${state.workspaceId}, ${state.text},
      ${state.savedByThreadId}, ${state.savedByTitle}, ${state.savedAt}, ${state.updatedAt}, ${state.lastUsedAt},
      ${state.uses}, ${state.isPinned}, ${state.originKind}, ${state.originEntry}, ${state.originFrom},
      ${state.originExcerpt})`;
});

/** Adds one history entry made by a thread or the owner. */
export const insertEntry = Effect.fnUntraced(function* (entry: EntryRecord) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const threadId = entry.actor.kind === "Thread" ? entry.actor.threadId : null;
  const state = entry.after ?? entry.before;
  const id = yield* newId;
  yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, actor_thread_id, actor_title, at, approved_at,
      before_state, after_state, scope_thread_id, undid, undo_of)
    VALUES (${id}, ${entry.loreEntryId}, ${entry.kind}, ${entry.actor.kind}, ${threadId},
      (SELECT title FROM threads WHERE id = ${threadId}), ${now}, ${entry.approvedAt},
      ${entry.before === null ? null : JSON.stringify(entry.before)},
      ${entry.after === null ? null : JSON.stringify(entry.after)}, ${state?.threadId ?? null},
      ${entry.undid?.kind ?? null}, ${entry.undid?.id ?? null})`;
});

/** Stores the fading steps a lore entry took since its last use and that are not stored yet. */
export const recordStepsOf = Effect.fnUntraced(function* (state: Snapshot) {
  const sql = yield* SqlClient.SqlClient;
  for (const step of yield* unrecordedStepsOf(state, yield* readFading)) {
    yield* sql`INSERT INTO intel_history (id, intel_id, kind, actor, at, scope_thread_id)
      VALUES (${fadingEntryIdOf(state.id, step.kind, step.at)}, ${state.id}, ${step.kind}, 'Fading', ${step.at},
        ${state.threadId})`;
  }
});

/** Stores the fading steps each lore entry took since its last use so they stay in its history after a reset. */
export const recordFadingSteps = (loreEntryIds: ReadonlyArray<string>) =>
  Effect.forEach(
    loreEntryIds,
    (loreEntryId) =>
      readSnapshot(loreEntryId).pipe(Effect.flatMap((state) => (state === null ? Effect.void : recordStepsOf(state)))),
    { discard: true },
  );

/** Runs a change to one lore entry and records it with the state before and after, fading steps up to now first. */
export const trackChange = <Failure, Requirements>(
  loreEntryId: string,
  kind: LoreHistoryKind,
  actor: Actor,
  approvedAt: number | null,
  change: Effect.Effect<unknown, Failure, Requirements>,
) =>
  Effect.gen(function* () {
    const before = yield* readSnapshot(loreEntryId);
    if (before !== null) yield* recordStepsOf(before);
    yield* change;
    const after = yield* readSnapshot(loreEntryId);
    yield* insertEntry({ actor, after, approvedAt, before, kind, loreEntryId, undid: null });
  });

/** Deletes a lore entry; a deletion by the owner also declines the changes awaiting approval on it. */
export const removeLoreEntry = Effect.fnUntraced(function* (loreEntryId: string, actor: Actor) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`DELETE FROM intels WHERE id = ${loreEntryId}`;
  // A thread's deletion leaves them for the owner, who finds nothing left to change (scoped-intel, Correcting).
  if (actor.kind !== "Owner") return;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE intel_changes SET status = 'Declined', resolved_at = ${now}
    WHERE intel_id = ${loreEntryId} AND status = 'Awaiting'`;
});
