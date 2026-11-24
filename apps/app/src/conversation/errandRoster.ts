import type { ThreadId, ThreadSummary } from "@outlore/contracts";
import { type FoldedThread, foldThreads } from "./folding";

/**
 * The errand roster: which errands a quest shows, how folding applies, how siblings rank, and how a preview is cut.
 * The sidebar, the Errands tab, the thread tree and the new errand's switch menu all read it, so the next change to the
 * order (it changed in CHG-0675 and again in CHG-0679) is one edit here.
 */

/** Siblings rank by latest activity, newest first, whatever their state (CHG-0679). */
const latestFirst = (current: FoldedThread, next: FoldedThread): number =>
  next.thread.lastActivityAt - current.thread.lastActivityAt;

/**
 * The folded rows with every parent's visible children ranked, each errand followed by what lies beneath it.
 * An errand whose opener was folded into an ancestor ranks among that ancestor's children.
 */
export const rankedFoldedOf = (
  threads: ReadonlyArray<ThreadSummary>,
  shouldShowAgentThreads: boolean,
  unfolded: ReadonlySet<string> = new Set(),
): FoldedThread[] => {
  const rows = foldThreads(threads, shouldShowAgentThreads, unfolded);
  // A row's parent is its nearest visible ancestor by `parentId`, not the row before it: the input is not in tree order.
  const rowOf = new Map(rows.map((row) => [row.thread.id, row]));
  const parentOf = new Map(threads.map((thread) => [thread.id, thread.parentId]));
  const children = new Map<FoldedThread | null, FoldedThread[]>();
  for (const row of rows) {
    let ancestor = row.thread.parentId;
    while (ancestor !== null && !rowOf.has(ancestor)) ancestor = parentOf.get(ancestor) ?? null;
    const parent = ancestor === null ? null : (rowOf.get(ancestor) ?? null);
    const siblings = children.get(parent);
    if (siblings === undefined) children.set(parent, [row]);
    else siblings.push(row);
  }

  const ordered: FoldedThread[] = [];
  const visit = (parent: FoldedThread | null): void => {
    const siblings = children.get(parent) ?? [];
    siblings.sort(latestFirst);
    for (const row of siblings) {
      ordered.push(row);
      visit(row);
    }
  };
  visit(null);
  return ordered;
};

/** One errand row of the sidebar: how deep it sits beneath its quest, and what it hides. */
export interface ErrandRow {
  /** Levels beneath the quest: 1 for a quest's own errands. */
  readonly depth: number;
  /** Threads the agents opened that the setting folds into this row. */
  readonly foldedCount: number;
  /** Whether it has errands beneath it, so it can expand and collapse. */
  readonly hasChildren: boolean;
  readonly thread: ThreadSummary;
}

/**
 * The errands a quest lists beneath their visible parents, siblings ranked.
 * Collapsing an errand hides its descendants, and the setting for agent-opened threads still folds them into their opener.
 */
export const errandRowsOf = (
  threads: ReadonlyArray<ThreadSummary>,
  options: { readonly collapsed: ReadonlySet<string>; readonly shouldShowAgentThreads: boolean },
): ReadonlyArray<ErrandRow> => {
  const rows = rankedFoldedOf(threads, options.shouldShowAgentThreads);
  const visible: ErrandRow[] = [];
  let hiddenBelow: number | null = null;
  rows.forEach((row, index) => {
    if (hiddenBelow !== null && row.depth > hiddenBelow) return;
    hiddenBelow = null;
    const hasChildren = (rows[index + 1]?.depth ?? 0) > row.depth;
    if (options.collapsed.has(row.thread.id)) hiddenBelow = row.depth;
    if (row.depth > 0)
      visible.push({ depth: row.depth, foldedCount: row.foldedCount, hasChildren, thread: row.thread });
  });
  return visible;
};

/** The errands the sidebar previews beneath an open quest. */
const errandPreviewLimit = 2;

/** The threads above a thread, nearest first, so the path to the one selected can be opened. */
export const ancestorIdsOf = (threads: ReadonlyArray<ThreadSummary>, id: ThreadId): ReadonlyArray<ThreadId> => {
  const parents = new Map(threads.map((thread) => [thread.id, thread.parentId]));
  const path: ThreadId[] = [];
  for (let parent = parents.get(id) ?? null; parent !== null; parent = parents.get(parent) ?? null) path.push(parent);
  return path;
};

/** Reveals the selected errand's ancestors, then cuts the ranked rows to the preview; the label counts every row. */
export const errandPreviewOf = (
  threads: ReadonlyArray<ThreadSummary>,
  options: {
    readonly collapsed: ReadonlySet<string>;
    readonly selectedThread: ThreadId | null;
    readonly shouldShowAgentThreads: boolean;
  },
) => {
  const ancestors = new Set<string>(
    options.selectedThread === null ? [] : ancestorIdsOf(threads, options.selectedThread),
  );
  const collapsed = new Set([...options.collapsed].filter((id) => !ancestors.has(id)));
  const rows = errandRowsOf(threads, { collapsed, shouldShowAgentThreads: options.shouldShowAgentThreads });
  return {
    collapsed,
    overflowLabel: rows.length > errandPreviewLimit ? `Show ${rows.length} errands` : null,
    rows: rows.slice(0, errandPreviewLimit),
  };
};

/** The errands directly beneath a thread that are not archived, ranked: what the Errands tab lists. */
export const childErrandsOf = (threads: ReadonlyArray<ThreadSummary>, parentId: ThreadId): ThreadSummary[] =>
  threads
    .filter((thread) => thread.parentId === parentId && thread.isArchived !== true)
    .sort((current, next) => next.lastActivityAt - current.lastActivityAt);

/**
 * Every errand beneath the quest that is not archived, nested and ranked like the sidebar, with none folded away: what
 * the new errand's switch menu offers.
 */
export const listedErrandsOf = (threads: ReadonlyArray<ThreadSummary>): ThreadSummary[] =>
  rankedFoldedOf(
    threads.filter((thread) => thread.isArchived !== true),
    true,
  )
    .filter((row) => row.thread.parentId !== null)
    .map((row) => row.thread);
