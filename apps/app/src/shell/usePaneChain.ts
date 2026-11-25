import type { ThreadId, ThreadSummary } from "@outlore/contracts";
import { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChronicleTargetContext } from "../conversation/chronicleTarget";
import { chainOf, equalizedPanes, layoutOf, openedQuestMemory, type PaneMemory, unfoldedPane } from "./paneChain";
import { channelId, type PaneId, paneContentsOf } from "./paneIds";
import { paneSessionOf } from "./paneSession";
import { readPaneWeights, rememberPaneWeights } from "./railStorage";

/** What the pane row shows and how it starts; the quest's threads come from its read. */
export type PaneChainInput = {
  /** Whether the realm's channel was open when this quest opened: it then stays open beside the quest. */
  isChannelOpen?: boolean;
  /** Whether no quest is open: the row is the channel alone, open, and a quest opened next joins it without remounting it. */
  isStandalone?: boolean;
  /** Told whether the channel pane is open, each time that changes, so the next quest can open the same way. */
  onChannelOpen?: (isOpen: boolean) => void;
  onOpenThread: (threadId: ThreadId) => void;
  /** Incremented when the owner selects a quest, so a folded quest or expanded channel yields to it without remounting. */
  openCount?: number;
  openThread: ThreadId | null;
  /** A request from the channel's own page to list its quests: each new object opens the Quests tab. */
  questsRequest?: object | null;
  threads: ReadonlyArray<ThreadSummary>;
};

const noChannelOpenTold = () => {};

/** Keeps the desktop pane layout and its fold, focus, and resize state. */
export function usePaneChain({
  isChannelOpen = false,
  isStandalone = false,
  onChannelOpen = noChannelOpenTold,
  onOpenThread,
  openCount = 0,
  openThread,
  questsRequest = null,
  threads,
}: PaneChainInput) {
  const path = useMemo(() => chainOf(threads, openThread), [threads, openThread]);
  const quest = path[0];
  const deepest = path.at(-1) ?? null;
  const contents = useMemo(() => paneContentsOf(quest ?? null, deepest), [quest, deepest]);
  const fullChain = useMemo(() => contents.map(({ id }) => id), [contents]);
  const starter = contents.find((content) => content.kind === "starter")?.id;
  const [{ memory, focused, expanded, listRequest }, dispatch] = useReducer(paneSessionOf, null, () => ({
    expanded: null,
    focused: null,
    listRequest: questsRequest === null ? null : ({ id: channelId } satisfies { id: PaneId }),
    memory: openedQuestMemory<PaneId>(channelId, readPaneWeights(), isChannelOpen),
  }));
  const isChannelFolded = memory.folded.has(channelId);
  useEffect(() => onChannelOpen(!isChannelFolded), [isChannelFolded, onChannelOpen]);
  const [available, setAvailable] = useState(0);
  // With no quest the channel is the only pane, so one the owner folded beside a quest opens again.
  useEffect(() => {
    if (isStandalone) dispatch({ type: "memory", update: (current) => unfoldedPane(current, channelId) });
  }, [isStandalone]);
  const lastQuestsRequest = useRef(questsRequest);
  useEffect(() => {
    if (lastQuestsRequest.current === questsRequest) return;
    lastQuestsRequest.current = questsRequest;
    if (questsRequest !== null) dispatch({ id: channelId, type: "list" });
  }, [questsRequest]);
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
  // A quest still loading has no chain: the channel shows alone if it was open, and waits folded otherwise.
  const isWaiting = quest === undefined && !isStandalone && memory.folded.has(channelId);
  const slots = useMemo(
    () =>
      isWaiting
        ? []
        : layoutOf({
            available,
            chain: fullChain,
            expanded,
            memory,
            ...(starter === undefined ? {} : { starter }),
          }).flatMap((slot) => {
            const content = contents[slot.depth];
            return content === undefined ? [] : [{ ...slot, content }];
          }),
    [available, contents, expanded, fullChain, isWaiting, memory, starter],
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
