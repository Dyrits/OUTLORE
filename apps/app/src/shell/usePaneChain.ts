import type { ThreadId, ThreadSummary } from "@outlore/contracts";
import { useEffect, useMemo, useState } from "react";
import {
  chainOf,
  desktopThreadsOf,
  emptyPaneMemory,
  equalizedPanes,
  foldedPane,
  layoutOf,
  type PaneMemory,
  prunedMemory,
  revealedPane,
} from "./paneChain";
import { channelId, isThreadPane, type PaneId, starterId } from "./paneIds";
import { readPaneWeights, rememberPaneWeights } from "./railStorage";

/** Keeps the desktop pane layout and its fold, focus, and resize state. */
export function usePaneChain(
  threads: ReadonlyArray<ThreadSummary>,
  openThread: ThreadId | null,
  onOpenThread: (threadId: ThreadId) => void,
) {
  const path = useMemo(() => chainOf(threads, openThread), [threads, openThread]);
  const quest = path[0];
  const deepest = path.at(-1) ?? null;
  const fullChain = useMemo<Array<PaneId>>(() => {
    const chosen = desktopThreadsOf(quest === undefined || deepest === null ? [] : [quest, deepest]);
    if (chosen.length === 0) return [];
    return chosen.length === 1 ? [channelId, ...chosen, starterId] : [channelId, ...chosen];
  }, [quest, deepest]);
  const [memory, setMemory] = useState<PaneMemory<PaneId>>(() => ({
    ...emptyPaneMemory<PaneId>(),
    weights: readPaneWeights(),
  }));
  const [focused, setFocused] = useState<ThreadId | null>(null);
  const [expanded, setExpanded] = useState<PaneId | null>(null);
  const [available, setAvailable] = useState(0);
  // A "+N" notch asks a pane to open its list of children; a new object each press, so a second press asks again.
  const [listRequest, setListRequest] = useState<{ id: PaneId } | null>(null);
  // Opening a thread focuses its pane; the folds of panes that left the chain are forgotten.
  useEffect(() => {
    setFocused(deepest);
    setMemory((current) => prunedMemory(current, fullChain));
    setExpanded((current) => (current !== null && fullChain.includes(current) ? current : null));
  }, [deepest, fullChain]);
  // The starter is folded again whenever another quest opens: its pane stays in the chain from one quest to the next, so
  // the pressed-open memory of the last quest would otherwise carry over to the new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the quest opening is what resets the starter.
  useEffect(() => {
    setMemory((current) =>
      current.shown.has(starterId)
        ? { ...current, shown: new Set([...current.shown].filter((each) => each !== starterId)) }
        : current,
    );
    setExpanded((current) => (current === starterId ? null : current));
  }, [quest]);
  const slots = useMemo(
    () => layoutOf({ available, chain: fullChain, expanded, memory, starter: starterId }),
    [available, expanded, fullChain, memory],
  );
  const openIds = useMemo(
    () => new Set(slots.flatMap((slot) => (slot.kind === "pane" && isThreadPane(slot.id) ? [slot.id] : []))),
    [slots],
  );
  const openSlots = slots.filter((slot) => slot.kind === "pane");
  const paneCount = openSlots.length;
  const focusedId = focused !== null && openIds.has(focused) ? focused : ([...openIds].at(-1) ?? null);
  const fold = (id: PaneId) => {
    setExpanded(null);
    setMemory((current) => {
      const next = foldedPane(current, id);
      const neighbor = fullChain.findLast((each) => each !== id);
      return neighbor !== undefined && fullChain.every((each) => next.folded.has(each))
        ? revealedPane(next, neighbor)
        : next;
    });
  };
  const revealThread = (threadId: ThreadId) => {
    // Opening a thread, from a notch or a list, exits the expanded layout: its pane is revealed instead.
    setExpanded(null);
    setMemory((current) => (current.folded.has(threadId) ? revealedPane(current, threadId) : current));
    onOpenThread(threadId);
  };
  const startErrand = (questId: ThreadId) => {
    setExpanded((current) => (current === null ? null : starterId));
    setMemory((current) => revealedPane(current, starterId));
    onOpenThread(questId);
  };
  // Every open pane gets the same share again, and the dragged shares are forgotten with the memory of them.
  const equalize = () => {
    setMemory(equalizedPanes);
    rememberPaneWeights([]);
  };
  const isExpandedPane = (id: PaneId) => paneCount === 1 && openSlots[0]?.id === id;
  const toggleExpanded = (id: PaneId) => {
    const isExpanded = isExpandedPane(id);
    if (isThreadPane(id)) setFocused(id);
    if (id === starterId && !isExpanded) setMemory((current) => revealedPane(current, id));
    if (isExpanded && expanded === null) setMemory((current) => ({ ...current, folded: new Set() }));
    setExpanded(isExpanded ? null : id);
  };
  const revealPane = (id: PaneId) => {
    setExpanded(null);
    if (isThreadPane(id)) setFocused(id);
    setMemory((current) => revealedPane(current, id));
  };
  return {
    available,
    equalize,
    focusedId,
    fold,
    fullChain,
    isExpandedPane,
    listRequest,
    memory,
    openIds,
    paneCount,
    quest,
    revealPane,
    revealThread,
    setAvailable,
    setFocused,
    setListRequest,
    setMemory,
    slots,
    startErrand,
    toggleExpanded,
  };
}
