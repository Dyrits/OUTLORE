import type { LoreEntry, LoreEntryId, LoreKind, LoreOrigin, LoreScope, MissionId } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { notFound, tokensOf } from "../core/index.ts";
import { type Fading, stateOfLoreEntry, strengthOf } from "./loreFading.ts";

// Stored and wire names keep `intel` so existing data and agents still work: table and column names (`intels`, `intel_id`, ...), thread tool names (`save_intel`, ...) and settings keys (`intelHalfLives`, `intelWarningPercent`).
// Scoped lore (scoped-intel): where each lore entry applies, its scope chain, and how stored rows are read and formatted.

/** The most tokens one lore entry holds, so one lore entry holds one fact (scoped-intel, Saving). */
export const loreLimit = 200;

/** Where a lore entry sits: a thread (the mission's top thread for the whole mission), a workspace, or everywhere. */
export type Placement = {
  readonly scope: LoreScope;
  readonly threadId: string | null;
  readonly workspaceId: string | null;
};

/** A thread's lookup scope: itself and each thread above it, nearest first, then its workspace. */
export type ScopeChain = {
  readonly missionId: string;
  readonly threads: ReadonlyArray<string>;
  readonly topThreadId: string;
  readonly workspaceId: string | null;
};

/** Where a stored lore entry sits. */
export const placementOfRow = (row: Pick<LoreEntryRow, "scope" | "threadId" | "workspaceId">): Placement => ({
  scope: row.scope,
  threadId: row.threadId,
  workspaceId: row.workspaceId,
});

/** How wide a placement is, from a thread (0) to the whole mission (1), a workspace (2), and everywhere (3). */
export const widthOf = (placement: Placement, topThreadId: string) =>
  (
    ({ Global: 3, Thread: placement.threadId === topThreadId ? 1 : 0, Workspace: 2 }) satisfies Record<
      LoreScope,
      number
    >
  )[placement.scope];

/** The lookup scope of a thread (scoped-intel, Lookup). */
export const readScopeChain = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string; missionId: string; workspaceId: string | null; depth: number }>`
      WITH RECURSIVE chain(id, depth) AS (
        SELECT id, 0 FROM threads WHERE id = ${threadId}
        UNION ALL SELECT t.parent_id, chain.depth + 1 FROM threads t JOIN chain ON t.id = chain.id
        WHERE t.parent_id IS NOT NULL
      )
      SELECT t.id, t.mission_id AS missionId, t.workspace_id AS workspaceId, chain.depth
      FROM chain JOIN threads t ON t.id = chain.id ORDER BY chain.depth`;
  const [own] = rows;
  if (own === undefined) return yield* notFound("No such thread.");
  return {
    missionId: own.missionId,
    threads: rows.map((row) => row.id),
    topThreadId: rows.at(-1)?.id ?? own.id,
    workspaceId: rows.at(-1)?.workspaceId ?? null,
  } satisfies ScopeChain;
});

/** One stored lore entry with what its scope label needs. */
export type LoreEntryRow = {
  readonly id: string;
  readonly isPinned: number;
  readonly isTopThread: boolean;
  readonly kind: LoreKind;
  readonly lastUsedAt: number;
  readonly missionId: string | null;
  readonly missionTitle: string | null;
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: LoreOrigin["kind"] | null;
  readonly savedAt: number;
  readonly savedByTitle: string | null;
  readonly scope: LoreScope;
  readonly text: string;
  readonly threadId: string | null;
  readonly threadTitle: string | null;
  readonly updatedAt: number;
  readonly uses: number;
  readonly workspaceId: string | null;
  readonly workspaceName: string | null;
};

/** A lore entry row as SQLite returns it: `isTopThread` is its 0/1, or null when no thread is joined. */
export type LoreEntrySqlRow = Omit<LoreEntryRow, "isTopThread"> & {
  readonly isTopThread: number | null;
};

/** Reads a lore entry row's SQLite 0/1 flag as the boolean the rest of the code uses. */
export const loreEntryRowOf = (row: LoreEntrySqlRow): LoreEntryRow => ({ ...row, isTopThread: row.isTopThread === 1 });

/** Selects lore entries with what their scope labels need; callers add the condition and order. */
export const selectLoreEntries = (sql: SqlClient.SqlClient) => sql`
  SELECT i.id, i.scope, i.kind, i.is_pinned AS isPinned, i.uses, i.last_used_at AS lastUsedAt, i.text, i.thread_id AS threadId, i.workspace_id AS workspaceId, i.saved_by_title AS savedByTitle,
    i.origin_kind AS originKind, i.origin_entry AS originEntry, i.origin_from AS originFrom,
    i.origin_excerpt AS originExcerpt, i.saved_at AS savedAt, i.updated_at AS updatedAt, t.title AS threadTitle, t.mission_id AS missionId,
    m.title AS missionTitle, (m.top_thread_id = i.thread_id) AS isTopThread, w.name AS workspaceName
  FROM intels i LEFT JOIN threads t ON t.id = i.thread_id LEFT JOIN missions m ON m.id = t.mission_id
  LEFT JOIN workspaces w ON w.id = i.workspace_id`;

/** The scope of a lore entry or a change in words, for the owner and for threads. */
export const scopeLabelOf = (row: {
  readonly scope: LoreScope;
  readonly isTopThread: boolean;
  readonly missionTitle: string | null;
  readonly threadTitle: string | null;
  readonly workspaceName: string | null;
}) =>
  ({
    Global: "Global",
    Thread: row.isTopThread ? `Quest "${row.missionTitle ?? ""}"` : `Errand "${row.threadTitle ?? "a deleted errand"}"`,
    Workspace: `Realm ${row.workspaceName ?? ""}`,
  })[row.scope];

/** What a stored lore entry or change rests on, or null when it records none. */
export const originOf = (row: {
  readonly originEntry: number | null;
  readonly originExcerpt: string | null;
  readonly originFrom: string | null;
  readonly originKind: LoreOrigin["kind"] | null;
}): LoreOrigin | null =>
  row.originKind === null
    ? null
    : { entryNumber: row.originEntry, excerpt: row.originExcerpt ?? "", from: row.originFrom, kind: row.originKind };

/** A lore entry as the owner reads it, with its strength at that time. */
export const loreEntryOf = (row: LoreEntryRow, fading: Fading): LoreEntry => ({
  id: row.id as LoreEntryId,
  isPinned: row.isPinned === 1,
  kind: row.kind,
  lastUsedAt: row.lastUsedAt,
  missionId: row.missionId as MissionId | null,
  origin: originOf(row),
  savedAt: row.savedAt,
  savedByTitle: row.savedByTitle,
  scope: row.scope,
  scopeLabel: scopeLabelOf(row),
  state: stateOfLoreEntry(row, fading),
  strength: strengthOf(row, fading),
  text: row.text,
  tokens: tokensOf(row.text),
  updatedAt: row.updatedAt,
  uses: row.uses,
});

/** The lore in a thread's scope, most specific first: the thread, each thread above, the workspace, then global. */
export const listInScope = Effect.fnUntraced(function* (chain: ScopeChain) {
  const sql = yield* SqlClient.SqlClient;
  const rows = (yield* sql<LoreEntrySqlRow>`${selectLoreEntries(sql)}
      WHERE (i.scope = 'Thread' AND i.thread_id IN ${sql.in(chain.threads)})
        OR (i.scope = 'Workspace' AND i.workspace_id = ${chain.workspaceId})
        OR i.scope = 'Global'
      ORDER BY i.saved_at DESC`).map(loreEntryRowOf);
  const rankOf = (row: LoreEntryRow) =>
    row.scope === "Thread" ? chain.threads.indexOf(row.threadId ?? "") : row.scope === "Workspace" ? 1e6 : 2e6;
  // Stable sort: within one scope the newest stays first.
  return rows.toSorted((first, second) => rankOf(first) - rankOf(second));
});

/** One stored lore entry, or null when it no longer exists. */
export const readLoreEntry = Effect.fnUntraced(function* (loreEntryId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<LoreEntrySqlRow>`${selectLoreEntries(sql)} WHERE i.id = ${loreEntryId}`;
  return row === undefined ? null : loreEntryRowOf(row);
});

const agentLabelOf = (row: LoreEntryRow) =>
  ({
    Global: "global",
    Thread: row.isTopThread ? "quest" : `errand "${row.threadTitle ?? ""}"`,
    Workspace: "realm",
  })[row.scope];

/** Lore as a thread reads it in full: one line each, with its identifier, scope, and kind. */
export const loreLinesOf = (rows: ReadonlyArray<LoreEntryRow>) =>
  rows.map((row) => `- [${row.id}] (${agentLabelOf(row)}, ${row.kind.toLowerCase()}) ${row.text}`).join("\n");
