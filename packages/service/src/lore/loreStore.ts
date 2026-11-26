import type { LoreKind, LoreOrigin } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { newId } from "../core/index.ts";
import type { Placement } from "./lore.ts";
import { type Actor, owner, readSnapshot, threadActor } from "./loreHistory.ts";
import { originColumnsOf } from "./loreOrigins.ts";
import { insertEntry, removeLoreEntry, trackChange } from "./loreStoreCore.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...).
// Single-entry lore mutations: each records its own history entry and stores unrecorded fading steps first.

/** A new lore entry as a thread saves it, with what it rests on. */
type NewLoreEntry = {
  readonly kind: LoreKind;
  readonly origin: LoreOrigin | null;
  readonly placement: Placement;
  readonly text: string;
  /** The thread that saved it, which is the actor of its save. */
  readonly threadId: string;
};

/** Saves a new lore entry and records its save, approved by the owner when the time is given; returns its id. */
export const insertLoreEntry = Effect.fnUntraced(function* (loreEntry: NewLoreEntry, approvedAt: number | null = null) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const id = yield* newId;
  const origin = originColumnsOf(loreEntry.origin);
  const { placement } = loreEntry;
  yield* sql`INSERT INTO intels (id, scope, kind, thread_id, workspace_id, text, saved_by_thread_id, saved_by_title,
      saved_at, updated_at, last_used_at, origin_kind, origin_entry, origin_from, origin_excerpt)
    VALUES (${id}, ${placement.scope}, ${loreEntry.kind}, ${placement.threadId}, ${placement.workspaceId},
      ${loreEntry.text.trim()}, ${loreEntry.threadId}, (SELECT title FROM threads WHERE id = ${loreEntry.threadId}), ${now},
      ${now}, ${now}, ${origin.originKind}, ${origin.originEntry}, ${origin.originFrom}, ${origin.originExcerpt})`;
  const after = yield* readSnapshot(id);
  yield* insertEntry({
    actor: threadActor(loreEntry.threadId),
    after,
    approvedAt,
    before: null,
    kind: "Saved",
    loreEntryId: id,
    undid: null,
  });
  return id;
});

/** Corrects a lore entry's text where it is: Edited by the owner, Corrected by a thread. */
export const correctLoreEntry = Effect.fnUntraced(function* (
  loreEntryId: string,
  text: string,
  actor: Actor,
  approvedAt: number | null = null,
) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const kind = actor.kind === "Owner" ? "Edited" : "Corrected";
  yield* trackChange(
    loreEntryId,
    kind,
    actor,
    approvedAt,
    sql`UPDATE intels SET text = ${text.trim()}, updated_at = ${now} WHERE id = ${loreEntryId}`,
  );
});

/** Moves a lore entry to a wider or narrower scope, with new text when given. */
export const moveLoreEntry = Effect.fnUntraced(function* (
  loreEntryId: string,
  placement: Placement,
  text: string | null,
  kind: "Widened" | "Narrowed",
  actor: Actor,
  approvedAt: number | null = null,
) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* trackChange(
    loreEntryId,
    kind,
    actor,
    approvedAt,
    sql`UPDATE intels SET scope = ${placement.scope}, thread_id = ${placement.threadId},
        workspace_id = ${placement.workspaceId}, text = COALESCE(${text?.trim() ?? null}, text), updated_at = ${now}
        WHERE id = ${loreEntryId}`,
  );
});

/** Gives a lore entry a replacement's text, kind, and origin while keeping its identifier, scope, and uses (provisional, work-in-progress Batch 14). */
export const replaceLoreEntry = Effect.fnUntraced(function* (
  loreEntryId: string,
  replacement: { readonly kind: LoreKind; readonly origin: LoreOrigin | null; readonly text: string },
  actor: Actor,
  approvedAt: number | null = null,
) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const origin = originColumnsOf(replacement.origin);
  yield* trackChange(
    loreEntryId,
    "Replaced",
    actor,
    approvedAt,
    sql`UPDATE intels SET kind = ${replacement.kind}, text = ${replacement.text.trim()}, updated_at = ${now},
        last_used_at = ${now}, origin_kind = ${origin.originKind}, origin_entry = ${origin.originEntry},
        origin_from = ${origin.originFrom}, origin_excerpt = ${origin.originExcerpt}
        WHERE id = ${loreEntryId}`,
  );
});

/** The owner pins a lore entry so it never fades, or unpins it. */
export const pinLoreEntry = Effect.fnUntraced(function* (loreEntryId: string, isPinned: boolean) {
  const sql = yield* SqlClient.SqlClient;
  yield* trackChange(
    loreEntryId,
    isPinned ? "Pinned" : "Unpinned",
    owner,
    null,
    sql`UPDATE intels SET is_pinned = ${isPinned ? 1 : 0} WHERE id = ${loreEntryId}`,
  );
});

/** Deletes a lore entry; the owner's deletion declines the changes awaiting approval on it. */
export const deleteLoreEntry = (loreEntryId: string, actor: Actor, approvedAt: number | null = null) =>
  trackChange(loreEntryId, "Deleted", actor, approvedAt, removeLoreEntry(loreEntryId, actor));

/** The owner makes a dormant or archived lore entry active again at full strength without counting a use (work-in-progress, Batch 13). */
export const restoreLoreEntry = Effect.fnUntraced(function* (loreEntryId: string) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* trackChange(
    loreEntryId,
    "Restored",
    owner,
    null,
    sql`UPDATE intels SET last_used_at = ${now} WHERE id = ${loreEntryId}`,
  );
});
