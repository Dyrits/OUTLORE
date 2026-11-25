// The rules of the pane chain (CHG-0561): which threads the window shows as panes, how the room is shared, and how a
// pane is folded, brought back or resized. The window only draws what these return, so they run in plain Node.

/** The most panes shown at once (conversation-panes, CHG-0566): the channel, the quest and one errand. */
export const maxPanes = 3;
/** The least width of an open pane, in pixels. */
export const minPaneWidth = 380;

/**
 * The chain of threads from the quest's own thread down to the open one, each the parent of the next: the panes, left
 * to right. The chain follows the tree, so opening an errand from any pane drops the panes to its right, closing a pane
 * drops it with what hangs from it, and choosing an errand in the sidebar builds its whole chain.
 */
export const chainOf = <Id extends string>(
  threads: ReadonlyArray<{ id: Id; parentId: Id | null }>,
  openId: Id | null,
): Array<Id> => {
  const top = threads.find((thread) => thread.parentId === null);
  if (top === undefined) return [];
  const chain: Array<Id> = [];
  let current = threads.find((thread) => thread.id === openId) ?? top;
  // A cycle cannot occur in a tree; the bound keeps a corrupted one from looping.
  for (let step = 0; step <= threads.length; step += 1) {
    chain.unshift(current.id);
    const parent = threads.find((thread) => thread.id === current.parentId);
    if (parent === undefined) break;
    current = parent;
  }
  return chain;
};

/** One slot for the quest and one for the selected errand, including an old nested errand. */
export const desktopThreadsOf = <Id extends string>(path: ReadonlyArray<Id>): ReadonlyArray<Id> => {
  const quest = path[0];
  const selected = path.at(-1);
  if (quest === undefined) return [];
  return selected === undefined || selected === quest ? [quest] : [quest, selected];
};

/** What the owner did to the panes, kept between renders: the folds, the panes pressed back open, and the shares. */
export type PaneMemory<Id extends string> = {
  /** The panes the owner folded to strips. */
  readonly folded: ReadonlySet<Id>;
  /** The panes the owner brought back from a strip: they keep their room when the window squeezes the others. */
  readonly shown: ReadonlySet<Id>;
  /** The relative share of each open pane, by its depth in the chain; a missing or zero share is an equal one. */
  readonly weights: ReadonlyArray<number>;
};

/** Nothing folded, nothing pressed back open, equal shares. */
export const emptyPaneMemory = <Id extends string>(): PaneMemory<Id> => ({
  folded: new Set(),
  shown: new Set(),
  weights: [],
});

/** The memory with a pane folded to a strip. */
export const foldedPane = <Id extends string>(memory: PaneMemory<Id>, id: Id): PaneMemory<Id> => ({
  ...memory,
  folded: new Set([...memory.folded, id]),
  shown: new Set([...memory.shown].filter((each) => each !== id)),
});

/**
 * The memory a quest opens with: its realm's channel folded behind its notch (the owner, 2026-11-21; CHG-0613), so
 * only the quest's own conversation is open. Pressing the channel's notch on that pane's edge brings it back. A
 * channel that was already open, as a screen of its own or as a pane beside the previous quest, stays open (the
 * owner, 2026-11-24): opening a quest, an existing one or a new one, never closes what the owner had open.
 * The weights the panes last had are kept, for when another pane is revealed again.
 */
export const openedQuestMemory = <Id extends string>(
  channel: Id,
  weights: ReadonlyArray<number>,
  isChannelOpen = false,
): PaneMemory<Id> => ({
  folded: new Set(isChannelOpen ? [] : [channel]),
  shown: new Set(),
  weights: [...weights],
});

/**
 * The memory with a strip pressed back open. The other panes give way to it as the window needs: the earliest ones
 * that were not pressed open themselves fold first.
 */
export const revealedPane = <Id extends string>(memory: PaneMemory<Id>, id: Id): PaneMemory<Id> => ({
  ...memory,
  folded: new Set([...memory.folded].filter((each) => each !== id)),
  shown: new Set([...memory.shown, id]),
});

/** The memory with the dragged shares forgotten: the open panes share the room equally again, and folds stay as they are. */
export const equalizedPanes = <Id extends string>(memory: PaneMemory<Id>): PaneMemory<Id> => ({
  ...memory,
  weights: [],
});

/** The memory with a pane open again, without pressing it: a channel the owner folded beside a quest opens as the window's only pane. */
export const unfoldedPane = <Id extends string>(memory: PaneMemory<Id>, id: Id): PaneMemory<Id> =>
  memory.folded.has(id) ? { ...memory, folded: new Set([...memory.folded].filter((each) => each !== id)) } : memory;

/**
 * The memory without the panes that left the chain, so a pane opened again later starts open. A chain still waiting
 * to load is empty and prunes nothing, so the folds a quest opens with survive the read.
 */
export const prunedMemory = <Id extends string>(memory: PaneMemory<Id>, chain: ReadonlyArray<Id>): PaneMemory<Id> => {
  if (chain.length === 0) return memory;
  return {
    ...memory,
    folded: new Set([...memory.folded].filter((id) => chain.includes(id))),
    shown: new Set([...memory.shown].filter((id) => chain.includes(id))),
  };
};

/** Why a pane is a strip: folded by the owner, or older than the last four, or squeezed by the window's width. */
export type StripReason = "folded" | "overflow" | "narrow";

/** One place in the row of panes, in the order of the chain. */
export type PaneSlot<Id extends string> =
  | { depth: number; id: Id; kind: "pane"; width: number }
  | { depth: number; id: Id; kind: "strip"; reason: StripReason; width: number };

/** Shares `room` between the weights, each pane at least `minPaneWidth`, the weights keeping their proportion otherwise. */
const sharesOf = (room: number, weights: ReadonlyArray<number>): Array<number> => {
  const widths = weights.map(() => 0);
  const fixed = new Set<number>();
  for (let round = 0; round <= weights.length; round += 1) {
    const free = weights.map((_, index) => index).filter((index) => !fixed.has(index));
    const total = free.reduce((sum, index) => sum + (weights[index] ?? 1), 0);
    const left = room - fixed.size * minPaneWidth;
    const tooSmall = free.filter((index) => (left * (weights[index] ?? 1)) / total < minPaneWidth);
    if (tooSmall.length === 0 || tooSmall.length === free.length) {
      for (const index of free)
        widths[index] = tooSmall.length === 0 ? (left * (weights[index] ?? 1)) / total : minPaneWidth;
      break;
    }
    for (const index of tooSmall) {
      fixed.add(index);
      widths[index] = minPaneWidth;
    }
  }
  return widths;
};

/**
 * The row of panes and folded slots for a chain in `available` pixels. At most four panes are open; the earlier ones of a
 * longer chain, the ones the owner folded, and the ones the window is too narrow for are strips.
 * The deepest pane that the owner has left open keeps its space when the window narrows.
 * The errand starter is a strip until the owner reveals it.
 * The open panes share what the strips leave, equally unless the owner dragged an edge.
 */
export const layoutOf = <Id extends string>(input: {
  available: number;
  chain: ReadonlyArray<Id>;
  memory: PaneMemory<Id>;
  starter?: Id;
  expanded?: Id | null;
}): Array<PaneSlot<Id>> => {
  const { available, chain, memory, starter, expanded } = input;
  const expandedIndex = expanded == null ? -1 : chain.indexOf(expanded);
  const starterIndex = starter !== undefined && memory.shown.has(starter) ? chain.indexOf(starter) : -1;
  const lastConversation = chain.findLastIndex((id) => id !== starter && !memory.folded.has(id));
  const last =
    expandedIndex >= 0
      ? expandedIndex
      : starterIndex >= 0
        ? starterIndex
        : Math.max(lastConversation >= 0 ? lastConversation : chain.findLastIndex((id) => !memory.folded.has(id)), 0);
  const firstOpen = Math.max(0, chain.length - maxPanes);
  const reasons: Array<StripReason | null> = chain.map((id, index) => {
    if (index === last) return null;
    if (expandedIndex >= 0) return "folded";
    if (memory.shown.has(id)) return null;
    if (memory.folded.has(id) || id === starter) return "folded";
    return index < firstOpen ? "overflow" : null;
  });
  const openCount = () => reasons.filter((reason) => reason === null).length;
  /** Folds the earliest open pane that was not pressed open, or any but the deepest when only such panes are left. */
  const foldEarliest = (reason: StripReason): boolean => {
    const isFoldable = (index: number) => reasons[index] === null && index !== last;
    const unpressed = chain.findIndex((id, each) => isFoldable(each) && !memory.shown.has(id));
    const index = unpressed >= 0 ? unpressed : chain.findIndex((_, each) => isFoldable(each));
    if (index < 0) return false;
    reasons[index] = reason;
    return true;
  };
  while (openCount() > maxPanes && foldEarliest("overflow")) {}
  // A folded pane takes no room: its notch sits on the edge of the open pane beside it.
  while (openCount() > 1 && available < openCount() * minPaneWidth && foldEarliest("narrow")) {}
  const room = available;
  const open = chain.map((_, index) => index).filter((index) => reasons[index] === null);
  const defined = open.map((index) => memory.weights[index] ?? 0).filter((weight) => weight > 0);
  const fallback = defined.length === 0 ? 1 : defined.reduce((sum, weight) => sum + weight, 0) / defined.length;
  const weights = open.map((index) =>
    (memory.weights[index] ?? 0) > 0 ? (memory.weights[index] ?? fallback) : fallback,
  );
  const shares = open.length === 1 ? [room] : sharesOf(room, weights);
  // Whole pixels, the deepest open pane taking what rounding left, so the row fills the window.
  const widths = shares.map((share) => Math.floor(share));
  if (widths.length > 0) widths[widths.length - 1] = room - widths.slice(0, -1).reduce((sum, width) => sum + width, 0);
  return chain.map((id, depth): PaneSlot<Id> => {
    const reason = reasons[depth] ?? null;
    if (reason !== null) return { depth, id, kind: "strip", reason, width: 0 };
    return { depth, id, kind: "pane", width: widths[open.indexOf(depth)] ?? room };
  });
};

/**
 * The shares after the edge between two neighboring open panes is dragged `dx` pixels to the right: room moves from
 * one to the other, neither below the least width. Every open pane's width is kept as its share, so the others stay as
 * they were; the result is indexed by depth.
 */
export const resizedWeights = <Id extends string>(input: {
  dx: number;
  leftId: Id;
  rightId: Id;
  slots: ReadonlyArray<PaneSlot<Id>>;
}): Array<number> => {
  const { dx, leftId, rightId, slots } = input;
  const left = slots.find((slot) => slot.id === leftId);
  const right = slots.find((slot) => slot.id === rightId);
  const weights: Array<number> = slots.map(() => 0);
  for (const slot of slots) if (slot.kind === "pane") weights[slot.depth] = slot.width;
  if (left === undefined || right === undefined) return weights;
  const sum = left.width + right.width;
  const nextLeft = Math.min(sum - minPaneWidth, Math.max(minPaneWidth, left.width + dx));
  weights[left.depth] = nextLeft;
  weights[right.depth] = sum - nextLeft;
  return weights;
};
