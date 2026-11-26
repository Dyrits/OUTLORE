import type { LoreChange, LoreScope, LoreStateFilter, LoreView } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { toolRefusal, toolText, wordsOf } from "../core/index.ts";
import {
  type LoreEntryRow,
  type LoreEntrySqlRow,
  listInScope,
  loreEntryOf,
  loreEntryRowOf,
  loreLinesOf,
  readScopeChain,
  scopeLabelOf,
  selectLoreEntries,
} from "./lore.ts";
import type { ToolScope } from "./loreChanges.ts";
import { readGauge } from "./loreContext.ts";
import { readFading, stateOfLoreEntry } from "./loreFading.ts";
import { listDeletedLore } from "./loreHistoryViews.ts";
import { listLoreProposals } from "./loreProposals.ts";
import { countUses } from "./loreStoreMaintenance.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...) and thread tool names (`save_intel`, ...).

// What the owner and threads read of lore: the panel, a thread's changes, and search_intel.

/** The most lore entries `search_intel` answers with. */
const searchLimit = 20;
/** A word found in this many lore entries or fewer, such as a name, counts more in search (scoped-intel, External contract). */
const rareWordLimit = 3;
const rareWordWeight = 3;

const selectChanges = (sql: SqlClient.SqlClient) => sql`
  SELECT c.id, c.thread_id AS threadId, t.title AS threadTitle, c.kind, c.status, c.intel_id AS loreEntryId, c.scope,
    c.text, c.previous_text AS previousText, c.at, c.resolved_at AS resolvedAt, s.title AS scopeThreadTitle,
    m.title AS missionTitle, (m.top_thread_id = c.scope_thread_id) AS isTopThread, w.name AS workspaceName
  FROM intel_changes c JOIN threads t ON t.id = c.thread_id LEFT JOIN threads s ON s.id = c.scope_thread_id
  LEFT JOIN missions m ON m.id = s.mission_id LEFT JOIN workspaces w ON w.id = c.scope_workspace_id`;

type ChangeRow = Omit<LoreChange, "scopeLabel"> & {
  scopeThreadTitle: string | null;
  missionTitle: string | null;
  /** SQLite's 0/1, or null when no thread is joined. */
  isTopThread: number | null;
  workspaceName: string | null;
};

const changeOf = ({ scopeThreadTitle, missionTitle, isTopThread, workspaceName, ...row }: ChangeRow) => ({
  ...row,
  scopeLabel: scopeLabelOf({
    isTopThread: isTopThread === 1,
    missionTitle,
    scope: row.scope,
    threadTitle: scopeThreadTitle,
    workspaceName,
  }),
});

/** Every change awaiting the owner's approval, oldest first. */
const listAwaitingChanges = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<ChangeRow>`${selectChanges(sql)} WHERE c.status = 'Awaiting' ORDER BY c.at`;
  return rows.map(changeOf);
});

/** A thread's changes to lore, in the order made, as its conversation shows them. */
export const listThreadLoreChanges = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<ChangeRow>`${selectChanges(sql)} WHERE c.thread_id = ${threadId} ORDER BY c.at, c.rowid`;
  return rows.map(changeOf);
});

/**
 * The lore panel: one thread's scope or all lore, filtered by scope and state, and every change awaiting
 * approval.
 */
export const readLoreView = Effect.fnUntraced(function* (
  scope: LoreScope | null,
  state: LoreStateFilter | null,
  threadId: string | null,
  workspaceId: string | null = null,
) {
  const sql = yield* SqlClient.SqlClient;
  const fading = yield* readFading;
  const chain = threadId === null ? null : yield* readScopeChain(threadId);
  const rows =
    state === "Deleted"
      ? []
      : chain === null
        ? (yield* sql<LoreEntrySqlRow>`${selectLoreEntries(sql)} ORDER BY i.saved_at DESC`).map(loreEntryRowOf)
        : yield* listInScope(chain);
  const deleted = state === "Deleted" ? yield* listDeletedLore(chain, workspaceId) : [];
  const isOfState = (row: LoreEntryRow) =>
    state === null || (state === "Pinned" ? row.isPinned === 1 : stateOfLoreEntry(row, fading) === state);
  return {
    awaiting: yield* listAwaitingChanges,
    deleted: deleted.filter((loreEntry) => scope === null || loreEntry.scope === scope),
    gauge: threadId === null ? null : yield* readGauge(threadId),
    loreEntries: rows
      .filter(
        (row) =>
          (scope === null || row.scope === scope) &&
          (workspaceId === null || (row.scope === "Workspace" && row.workspaceId === workspaceId)) &&
          isOfState(row),
      )
      .map((row) => loreEntryOf(row, fading)),
    proposals: yield* listLoreProposals,
  } satisfies LoreView;
});

const isOfToolScope = (row: LoreEntryRow, scope: ToolScope) =>
  ({
    global: row.scope === "Global",
    mission: row.scope === "Thread" && row.isTopThread,
    thread: row.scope === "Thread" && !row.isTopThread,
    workspace: row.scope === "Workspace",
  })[scope];

/** Ranks lore entries by the query's words they share, a rare word counting more; ties keep the scope order. */
const rankByWords = (rows: ReadonlyArray<LoreEntryRow>, query: string) => {
  const wanted = wordsOf(query);
  const wordsByLoreEntry = new Map(rows.map((row) => [row.id, wordsOf(row.text)]));
  const loreEntriesWith = (word: string) => rows.filter((row) => wordsByLoreEntry.get(row.id)?.has(word)).length;
  const weights = new Map(
    [...wanted].map((word) => [word, loreEntriesWith(word) <= rareWordLimit ? rareWordWeight : 1]),
  );
  return rows
    .map((row) => {
      const words = wordsByLoreEntry.get(row.id) ?? new Set<string>();
      let score = 0;
      for (const [word, weight] of weights) if (words.has(word)) score += weight;
      return { row, score };
    })
    .filter(({ score }) => score > 0)
    .toSorted((first, second) => second.score - first.score)
    .map(({ row }) => row);
};

/** The thread's lore that search reads: in its scope and not archived. */
const searchableOf = Effect.fnUntraced(function* (threadId: string) {
  const fading = yield* readFading;
  return (yield* listInScope(yield* readScopeChain(threadId))).filter(
    (row) => stateOfLoreEntry(row, fading) !== "Archived",
  );
});

/**
 * `relied_on_intel`: a thread says lore entries shaped what it did, which counts one use of each (scoped-intel,
 * Fading). Only lore in its scope and not archived counts. Callers run it in a transaction.
 */
export const relyOnLore = Effect.fnUntraced(function* (threadId: string, ids: ReadonlyArray<string>) {
  const counted = (yield* searchableOf(threadId)).filter((row) => ids.includes(row.id)).map((row) => row.id);
  const missed = [...new Set(ids)].filter((id) => !counted.includes(id));
  const missedNote = missed.length === 0 ? "" : ` Not in your scope, or archived: ${missed.join(", ")}.`;
  if (counted.length === 0) return toolRefusal(`No use counted.${missedNote}`);
  yield* countUses(threadId, counted);
  return toolText(`Counted ${counted.length === 1 ? "1 use" : `${counted.length} uses`}.${missedNote}`);
});

/**
 * `search_intel`: the active and dormant lore in the thread's scope read by identifier or matching the
 * query's words, best match first. Each lore entry returned counts as a use, so it fades slower and a dormant one
 * becomes active again (scoped-intel, Fading); Chronicler's reads beyond its own scope count none. Callers run it in a
 * transaction.
 */
export const searchLoreText = Effect.fnUntraced(function* (
  threadId: string,
  query: string | null,
  ids: ReadonlyArray<string>,
  scope: ToolScope | null,
  isChronicler = false,
) {
  const sql = yield* SqlClient.SqlClient;
  const fading = yield* readFading;
  const available = isChronicler
    ? (yield* sql<LoreEntrySqlRow>`${selectLoreEntries(sql)}
          ORDER BY CASE WHEN i.scope = 'Global' THEN 3 WHEN i.scope = 'Workspace' THEN 2
            WHEN m.top_thread_id = i.thread_id THEN 1 ELSE 0 END, i.saved_at DESC`).map(loreEntryRowOf)
    : yield* listInScope(yield* readScopeChain(threadId));
  const rows = available.filter(
    (row) => stateOfLoreEntry(row, fading) !== "Archived" && (scope === null || isOfToolScope(row, scope)),
  );
  const named = rows.filter((row) => ids.includes(row.id));
  const matched = query === null ? [] : rankByWords(rows, query).filter((row) => !ids.includes(row.id));
  const found = [...named, ...matched].slice(0, searchLimit);
  if (found.length === 0) {
    return "No lore matches. Your context already lists the active lore in your scope, and global lore as an index.";
  }
  // Chronicler's wider reads are not use: only lore in its own scope counts, so reading across scopes neither delays
  // fading nor wakes dormant lore nor skews the evidence for narrowing.
  const ownIds = isChronicler
    ? new Set((yield* listInScope(yield* readScopeChain(threadId))).map((row) => row.id))
    : null;
  const counted = found.filter((row) => ownIds === null || ownIds.has(row.id)).map((row) => row.id);
  if (counted.length > 0) yield* countUses(threadId, counted);
  return `Lore found, best match first; when two conflict, the more specific scope wins:\n${loreLinesOf(found)}`;
});
