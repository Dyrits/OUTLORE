import type { ThreadId, ThreadSummary } from "@outlore/contracts";
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChronicleTargetContext } from "../conversation/chronicleTarget";
import { chainOf, equalizedPanes, layoutOf, openedQuestMemory, type PaneMemory } from "./paneChain";
import { channelId, type PaneId, paneContentsOf } from "./paneIds";
import { paneSessionOf } from "./paneSession";
import { readPaneWeights, rememberPaneWeights } from "./railStorage";

/** Keeps the desktop pane layout and its fold, focus, and resize state. */
export function usePaneChain(
  threads: ReadonlyArray<ThreadSummary>,
  openThread: ThreadId | null,
  onOpenThread: (threadId: ThreadId) => void,
  /** Whether the realm's channel was open when this quest opened: it then stays open beside the quest. */
  isChannelOpen = false,
  /** Told whether the channel pane is open, each time that changes, so the next quest can open the same way. */
  onChannelOpen: (isOpen: boolean) => void = () => {},
  /** Incremented when the owner selects a quest, so a folded quest or expanded channel yields to it without remounting. */
  openCount = 0,
) {
  const path = useMemo(() => chainOf(threads, openThread), [threads, openThread]);
  const quest = path[0];
  const deepest = path.at(-1) ?? null;
  const contents = useMemo(() => paneContentsOf(quest ?? null, deepest), [quest, deepest]);
  const fullChain = useMemo(() => contents.map(({ id }) => id), [contents]);
  const starter = contents.find((content) => content.kind === "starter")?.id;
  const [{ memory, focused, expanded, listRequest }, dispatch] = useReducer(paneSessionOf, null, () => ({
    expanded: null,
    focused: null,
    listRequest: null,
    memory: openedQuestMemory<PaneId>(channelId, readPaneWeights(), isChannelOpen),
  }));
  const isChannelFolded = memory.folded.has(channelId);
  useEffect(() => onChannelOpen(!isChannelFolded), [isChannelFolded, onChannelOpen]);
  const [available, setAvailable] = useState(0);
  const target = useContext(ChronicleTargetContext);
  useEffect(() => {
    if (target !== null) dispatch({ quest: quest ?? null, target, thread: openThread, type: "target" });
  }, [target, openThread, quest]);
  useEffect(() => {
    dispatch({ chain: fullChain, deepest, type: "chain" });
  }, [deepest, fullChain]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: opening another quest resets its starter.
  useEffect(() => {
    dispatch({ type: "quest" });
  }, [quest]);
  const lastOpenCount = useRef(openCount);
  const questRef = useRef(quest);
  questRef.current = quest;
  useEffect(() => {
    if (lastOpenCount.current === openCount) return;
    lastOpenCount.current = openCount;
    dispatch({ quest: questRef.current ?? null, type: "reopenQuest" });
  }, [openCount]);
  const slots = useMemo(
    () =>
      layoutOf({
        available,
        chain: fullChain,
        expanded,
        memory,
        ...(starter === undefined ? {} : { starter }),
      }).flatMap((slot) => {
        const content = contents[slot.depth];
        return content === undefined ? [] : [{ ...slot, content }];
      }),
    [available, contents, expanded, fullChain, memory, starter],
  );
  const openIds = useMemo(
    () =>
      new Set(
        slots.flatMap(({ kind, content }) =>
          kind === "pane" && (content.kind === "quest" || content.kind === "errand") ? [content.id] : [],
        ),
      ),
    [slots],
  );
  const paneCount = slots.filter((slot) => slot.kind === "pane").length;
  const focusedId = focused !== null && openIds.has(focused) ? focused : ([...openIds].at(-1) ?? null);
  const fullChainRef = useRef(fullChain);
  fullChainRef.current = fullChain;
  const onOpenThreadRef = useRef(onOpenThread);
  onOpenThreadRef.current = onOpenThread;
  const fold = useCallback((id: PaneId) => dispatch({ chain: fullChainRef.current, id, type: "fold" }), []);
  const setMemory = useCallback(
    (update: (memory: PaneMemory<PaneId>) => PaneMemory<PaneId>) => dispatch({ type: "memory", update }),
    [],
  );
  const revealThread = useCallback((threadId: ThreadId) => {
    // Opening a thread, from a notch or a list, exits the expanded layout: its pane is revealed instead.
    dispatch({ id: threadId, type: "openThread" });
    onOpenThreadRef.current(threadId);
  }, []);
  const startErrand = useCallback((questId: ThreadId) => {
    dispatch({ type: "starter" });
    onOpenThreadRef.current(questId);
  }, []);
  // Every open pane gets the same share again, and the dragged shares are forgotten with the memory of them.
  const equalize = useCallback(() => {
    setMemory(equalizedPanes);
    rememberPaneWeights([]);
  }, [setMemory]);
  const revealPane = useCallback((id: PaneId) => dispatch({ id, type: "reveal" }), []);
  const expandPane = useCallback((id: PaneId) => dispatch({ id, type: "expand" }), []);
  const openList = useCallback((id: PaneId) => dispatch({ id, type: "list" }), []);
  const setFocused = useCallback((id: ThreadId) => dispatch({ id, type: "focus" }), []);
  return {
    available,
    equalize,
    expandPane,
    focusedId,
    fold,
    listRequest,
    memory,
    openIds,
    openList,
    paneCount,
    quest,
    revealPane,
    revealThread,
    setAvailable,
    setFocused,
    setMemory,
    slots,
    startErrand,
  };
}
