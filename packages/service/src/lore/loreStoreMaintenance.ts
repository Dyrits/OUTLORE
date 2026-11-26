import type { LoreHistoryKind } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { owner, readSnapshot, type Snapshot } from "./loreHistory.ts";
import {
  insertEntry,
  recordFadingSteps,
  recordStepsOf,
  removeLoreEntry,
  trackChange,
  writeSnapshot,
} from "./loreStoreCore.ts";

// Bulk and lifecycle lore store operations: merging, usage counting, undo writes, and thread erasure.

/** The owner merges lore entries into one global lore entry, deleting merged entries and transferring their uses to the kept entry. */
export const mergeLoreEntries = Effect.fnUntraced(function* (keptId: string, mergedIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  const states = yield* Effect.forEach([keptId, ...mergedIds], readSnapshot);
  const present = states.filter((state) => state !== null);
  for (const mergedId of mergedIds) {
    yield* trackChange(
      mergedId,
      "Merged",
      owner,
      null,
      Effect.gen(function* () {
        yield* removeLoreEntry(mergedId, owner);
        // Its uses become the kept lore entry's, so later evidence counts them.
        yield* sql`UPDATE intel_uses SET intel_id = ${keptId} WHERE intel_id = ${mergedId}`;
      }),
    );
  }
  const now = yield* Clock.currentTimeMillis;
  const uses = present.reduce((sum, state) => sum + state.uses, 0);
  const lastUsedAt = Math.max(...present.map((state) => state.lastUsedAt));
  yield* trackChange(
    keptId,
    "Widened",
    owner,
    null,
    sql`UPDATE intels SET scope = 'Global', thread_id = NULL, workspace_id = NULL, uses = ${uses},
      last_used_at = ${lastUsedAt}, updated_at = ${now} WHERE id = ${keptId}`,
  );
});

/** Counts one use of each lore entry by a thread after recording any unrecorded fading steps. */
export const countUses = Effect.fnUntraced(function* (threadId: string, loreEntryIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* recordFadingSteps(loreEntryIds);
  yield* sql`UPDATE intels SET uses = uses + 1, last_used_at = ${now} WHERE id IN ${sql.in(loreEntryIds)}`;
  // Where each use happened is the evidence for narrowing (scoped-intel, Widening and narrowing).
  for (const loreEntryId of loreEntryIds) {
    yield* sql`INSERT INTO intel_uses (intel_id, at, workspace_id)
      SELECT ${loreEntryId}, ${now}, workspace_id FROM threads WHERE id = ${threadId}`;
  }
});

/** The history entry an undo reverts. */
type UndoneEntry = {
  readonly id: string;
  readonly kind: LoreHistoryKind;
  readonly loreEntryId: string;
};

/** The owner undoes one history entry, restoring the given state or deleting the entry when null, and appends an Undone entry. */
export const writeUndo = Effect.fnUntraced(function* (entry: UndoneEntry, state: Snapshot | null) {
  const sql = yield* SqlClient.SqlClient;
  const current = yield* readSnapshot(entry.loreEntryId);
  if (current !== null) yield* recordStepsOf(current);
  if (state === null) yield* removeLoreEntry(entry.loreEntryId, owner);
  else yield* writeSnapshot(state);
  yield* insertEntry({
    actor: owner,
    after: state,
    approvedAt: null,
    before: current,
    kind: "Undone",
    loreEntryId: entry.loreEntryId,
    undid: { id: entry.id, kind: entry.kind },
  });
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE intel_history SET undone_at = ${now} WHERE id = ${entry.id}`;
});

/** Erases deleted threads' own lore, deleted ones included, with its history, uses, and the threads' changes. */
export const eraseThreadsLore = Effect.fnUntraced(function* (threadIds: ReadonlyArray<string>) {
  const sql = yield* SqlClient.SqlClient;
  // The history goes first: a live lore entry's entries are found from the lore itself.
  yield* sql`DELETE FROM intel_history WHERE intel_id IN (
      SELECT id FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)}
      UNION
      SELECT h.intel_id FROM intel_history h
      WHERE h.intel_id NOT IN (SELECT id FROM intels) AND h.scope_thread_id IN ${sql.in(threadIds)}
        AND h.rowid = (SELECT MAX(rowid) FROM intel_history WHERE intel_id = h.intel_id AND actor != 'Fading')
    )`;
  yield* sql`DELETE FROM intel_uses WHERE intel_id IN (
      SELECT id FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)})`;
  yield* sql`DELETE FROM intels WHERE scope = 'Thread' AND thread_id IN ${sql.in(threadIds)}`;
  yield* sql`DELETE FROM intel_changes WHERE thread_id IN ${sql.in(threadIds)}
    OR scope_thread_id IN ${sql.in(threadIds)}`;
});
