import type { ThreadId, ThreadSummary } from "@outlore/contracts";
import { useContext, useEffect, useMemo, useReducer, useState } from "react";
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
    memory: openedQuestMemory<PaneId>(channelId, readPaneWeights()),
  }));
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
  const fold = (id: PaneId) => dispatch({ chain: fullChain, id, type: "fold" });
  const setMemory = (update: (memory: PaneMemory<PaneId>) => PaneMemory<PaneId>) =>
    dispatch({ type: "memory", update });
  const revealThread = (threadId: ThreadId) => {
    // Opening a thread, from a notch or a list, exits the expanded layout: its pane is revealed instead.
    dispatch({ id: threadId, type: "openThread" });
    onOpenThread(threadId);
  };
  const startErrand = (questId: ThreadId) => {
    dispatch({ type: "starter" });
    onOpenThread(questId);
  };
  // Every open pane gets the same share again, and the dragged shares are forgotten with the memory of them.
  const equalize = () => {
    setMemory(equalizedPanes);
    rememberPaneWeights([]);
  };
  const revealPane = (id: PaneId) => dispatch({ id, type: "reveal" });
  return {
    available,
    equalize,
    expandPane: (id: PaneId) => dispatch({ id, type: "expand" }),
    focusedId,
    fold,
    fullChain,
    listRequest,
    memory,
    openIds,
    openList: (id: PaneId) => dispatch({ id, type: "list" }),
    paneCount,
    quest,
    revealPane,
    revealThread,
    setAvailable,
    setFocused: (id: ThreadId) => dispatch({ id, type: "focus" }),
    setMemory,
    slots,
    startErrand,
  };
}
