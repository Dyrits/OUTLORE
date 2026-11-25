import type { ThreadId } from "@outlore/contracts";
import { type ChronicleTarget, matchesThread } from "../conversation/chronicleTarget";
import { foldedPane, type PaneMemory, prunedMemory, revealedPane } from "./paneChain";
import { isThreadPane, type PaneId, starterId } from "./paneIds";

/** Owner choices that persist for the pane row during a session. */
export type PaneSession = {
  memory: PaneMemory<PaneId>;
  focused: ThreadId | null;
  expanded: PaneId | null;
  listRequest: { id: PaneId } | null;
};

type PaneAction =
  | { type: "chain"; chain: ReadonlyArray<PaneId>; deepest: ThreadId | null }
  | { type: "quest" }
  | { type: "reopenQuest"; quest: ThreadId | null }
  | { type: "target"; target: ChronicleTarget; thread: ThreadId | null; quest: ThreadId | null }
  | { type: "fold"; id: PaneId; chain: ReadonlyArray<PaneId> }
  | { type: "reveal"; id: PaneId }
  | { type: "openThread"; id: ThreadId }
  | { type: "starter" }
  | { type: "expand"; id: PaneId }
  | { type: "focus"; id: ThreadId }
  | { type: "list"; id: PaneId }
  | { type: "memory"; update: (memory: PaneMemory<PaneId>) => PaneMemory<PaneId> };

/** Applies one pane gesture or navigation event. */
export const paneSessionOf = (session: PaneSession, action: PaneAction): PaneSession => {
  const { expanded, focused, memory } = session;
  if (action.type === "chain")
    return {
      ...session,
      expanded: expanded !== null && action.chain.includes(expanded) ? expanded : null,
      focused: action.deepest,
      memory: prunedMemory(memory, action.chain),
    };
  if (action.type === "quest")
    return {
      ...session,
      expanded: expanded === starterId ? null : expanded,
      memory: memory.shown.has(starterId)
        ? { ...memory, shown: new Set([...memory.shown].filter((id) => id !== starterId)) }
        : memory,
    };
  if (action.type === "reopenQuest") {
    const withoutStarter = memory.shown.has(starterId)
      ? { ...memory, shown: new Set([...memory.shown].filter((id) => id !== starterId)) }
      : memory;
    const revealed =
      action.quest !== null && withoutStarter.folded.has(action.quest)
        ? revealedPane(withoutStarter, action.quest)
        : withoutStarter;
    return { ...session, expanded: null, memory: revealed };
  }
  if (action.type === "target") {
    const id = action.target.threadId === null ? action.quest : action.thread;
    return id !== null && matchesThread(action.target, id, id === action.quest)
      ? { ...session, expanded: null, focused: id, memory: revealedPane(memory, id) }
      : session;
  }
  if (action.type === "fold") {
    const next = foldedPane(memory, action.id);
    const neighbor = action.chain.findLast((id) => id !== action.id);
    return {
      ...session,
      expanded: null,
      memory:
        neighbor !== undefined && action.chain.every((id) => next.folded.has(id)) ? revealedPane(next, neighbor) : next,
    };
  }
  if (action.type === "reveal")
    return {
      ...session,
      expanded: null,
      focused: isThreadPane(action.id) ? action.id : focused,
      memory: revealedPane(memory, action.id),
    };
  if (action.type === "openThread")
    return {
      ...session,
      expanded: null,
      memory: memory.folded.has(action.id) ? revealedPane(memory, action.id) : memory,
    };
  if (action.type === "starter")
    return {
      ...session,
      expanded: expanded === null ? null : starterId,
      memory: revealedPane(memory, starterId),
    };
  if (action.type === "expand")
    return {
      ...session,
      expanded: action.id,
      focused: isThreadPane(action.id) ? action.id : focused,
      memory: action.id === starterId ? revealedPane(memory, action.id) : memory,
    };
  if (action.type === "focus") return { ...session, focused: action.id };
  if (action.type === "list") return { ...session, listRequest: { id: action.id } };
  return { ...session, memory: action.update(memory) };
};
