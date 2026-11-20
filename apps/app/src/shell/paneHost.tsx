import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import { OpenPanes } from "../conversation/replyLine";
import type { ServiceClient } from "../foundation/client";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { FoldPaneButton } from "../ui/questHeaderButtons";
import { ChannelPane, channelId } from "./channelPane";
import { ErrandStarter } from "./errandStarter";
import {
  chainOf,
  desktopThreadsOf,
  emptyPaneMemory,
  equalizedPanes,
  foldedPane,
  layoutOf,
  type PaneMemory,
  prunedMemory,
  resizedWeights,
  revealedPane,
} from "./paneChain";
import { PaneResizer } from "./paneResizer";
import { type NotchKind, type NotchPart, PaneButton, PaneNotches } from "./paneStrip";
import { readPaneWeights, rememberPaneWeights } from "./railStorage";

/** One channel slot and up to two threads of the quest. */
const starterId = "errand-starter";
type PaneId = ThreadId | typeof channelId | typeof starterId;

/** Shows the channel, quest and selected errand. An older nested errand uses the same third slot. */
export function PaneHost({
  client,
  missionId,
  isParked = false,
  onOpenMission,
  onOpenThread,
  openThread,
}: {
  client: ServiceClient;
  /** Whether the Workshop covers the panes: they stay as they are, out of sight, and take no part in the details panel. */
  isParked?: boolean;
  missionId: MissionId;
  onOpenMission: (missionId: MissionId) => void;
  /** Makes a thread the open one, which is the deepest pane of the chain. */
  onOpenThread: (threadId: ThreadId) => void;
  /** The deepest thread of the chain, or null for the quest's own thread. */
  openThread: ThreadId | null;
}) {
  const { data } = useServiceQuery(
    client,
    { _tag: "ReadMission", missionId, threadId: openThread },
    `${missionId}:${openThread ?? "top"}`,
  );
  // The tree comes with the thread's read; while another thread loads, the previous chain stays on show.
  const [threads, setThreads] = useState(data?.threads ?? []);
  useEffect(() => {
    if (data !== null) setThreads(data.threads);
  }, [data]);
  const path = useMemo(() => chainOf(threads, openThread), [threads, openThread]);
  const quest = path[0];
  const deepest = path.at(-1) ?? null;
  const fullChain = useMemo<Array<PaneId>>(() => {
    const chosen = desktopThreadsOf(quest === undefined || deepest === null ? [] : [quest, deepest]);
    if (chosen.length === 0) return [];
    return chosen.length === 1 ? [channelId, ...chosen, starterId] : [channelId, ...chosen];
  }, [quest, deepest]);
  const channel = { id: data?.mission.workspaceId ?? null, name: data?.mission.workspaceName ?? "Borderlands" };
  const [memory, setMemory] = useState<PaneMemory<PaneId>>(() => ({
    ...emptyPaneMemory<PaneId>(),
    weights: readPaneWeights(),
  }));
  const [focused, setFocused] = useState<ThreadId | null>(null);
  const [expanded, setExpanded] = useState<PaneId | null>(null);
  const [available, setAvailable] = useState(0);
  // Opening a thread focuses its pane; the folds of panes that left the chain are forgotten.
  useEffect(() => {
    setFocused(deepest);
    setMemory((current) => prunedMemory(current, fullChain));
    setExpanded((current) => (current !== null && fullChain.includes(current) ? current : null));
  }, [deepest, fullChain]);
  const slots = useMemo(
    () => layoutOf({ available, chain: fullChain, expanded, memory, starter: starterId }),
    [available, expanded, fullChain, memory],
  );
  const openIds = useMemo(
    () =>
      new Set(
        slots.flatMap((slot) =>
          slot.kind === "pane" && slot.id !== channelId && slot.id !== starterId ? [slot.id] : [],
        ),
      ),
    [slots],
  );
  const openSlots = slots.filter((slot) => slot.kind === "pane");
  const paneCount = openSlots.length;
  const dragStart = useRef(slots);
  const latest = useRef(memory);
  latest.current = memory;
  const focusedId = focused !== null && openIds.has(focused) ? focused : ([...openIds].at(-1) ?? null);
  const summaryOf = (id: ThreadId) => threads.find((thread) => thread.id === id);
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
    setExpanded((current) => (current === null ? null : threadId));
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
  const expandButton = (id: PaneId) => {
    const isExpanded = paneCount === 1 && openSlots[0]?.id === id;
    return (
      <PaneButton
        glyph={isExpanded ? "⊡" : "⛶"}
        label={isExpanded ? "Restore pane layout" : "Expand pane"}
        onPress={() => {
          if (id !== channelId && id !== starterId) setFocused(id);
          if (isExpanded && expanded === null) {
            setMemory((current) => ({ ...current, folded: new Set() }));
          }
          setExpanded(isExpanded ? null : id);
        }}
      />
    );
  };
  // Parked out of sight the row has no width: the panes keep the last they had, so they come back as they were.
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0) setAvailable(width);
  };
  const notchOf = (id: PaneId): NotchPart => {
    const summary = id === channelId || id === starterId ? undefined : summaryOf(id);
    const kind: NotchKind =
      id === channelId
        ? channel.id === null
          ? "borderlands"
          : "realm"
        : id === quest || id === starterId
          ? id === starterId
            ? "errand"
            : "quest"
          : "errand";
    return {
      id,
      kind,
      onReveal: () => {
        setExpanded(null);
        if (id !== channelId && id !== starterId) setFocused(id);
        setMemory((current) => revealedPane(current, id));
      },
      state: summary?.state ?? null,
      title: id === channelId ? channel.name : id === starterId ? "New errand" : (summary?.title ?? ""),
    };
  };
  // A folded pane is a notch on the edge of an open pane: the left edge of the next one, or the right edge of the last.
  const notchesAt = (depth: number): { left: Array<NotchPart>; right: Array<NotchPart> } => {
    const left: Array<NotchPart> = [];
    for (let each = depth - 1; slots[each]?.kind === "strip"; each -= 1) {
      const id = slots[each]?.id;
      if (id !== undefined) left.unshift(notchOf(id));
    }
    const right: Array<NotchPart> = [];
    if (slots.slice(depth + 1).every((slot) => slot.kind === "strip"))
      for (let each = depth + 1; slots[each]?.kind === "strip"; each += 1) {
        const id = slots[each]?.id;
        if (id !== undefined) right.push(notchOf(id));
      }
    return { left, right };
  };
  const firstOpen = slots.findIndex((slot) => slot.kind === "pane");
  // The strips between neighboring open panes, on the row above the panes, each at the edge it moves.
  let edge = 0;
  const resizers = slots.flatMap((slot, index) => {
    edge += slot.width;
    const next = slots[index + 1];
    if (slot.kind !== "pane" || next?.kind !== "pane") return [];
    return [
      <PaneResizer
        key={`resize:${slot.id}`}
        label="Resize the panes"
        left={edge}
        onDrag={(dx) =>
          setMemory((current) => ({
            ...current,
            weights: resizedWeights({ dx, leftId: slot.id, rightId: next.id, slots: dragStart.current }),
          }))
        }
        onEnd={() => rememberPaneWeights(latest.current.weights)}
        onStart={() => {
          dragStart.current = slots;
        }}
      />,
    ];
  });
  return (
    <OpenPanes.Provider value={openIds}>
      {paneCount > 1 && (
        <View style={local.toolbar}>
          <PaneButton glyph="↔" label="Equal widths" onPress={equalize} />
        </View>
      )}
      <View onLayout={onLayout} style={local.row}>
        {available > 0 &&
          slots.map((slot) => {
            const { id } = slot;
            const isStrip = slot.kind === "strip";
            const notches = isStrip ? { left: [], right: [] } : notchesAt(slot.depth);
            const wrap = (pane: ReactNode) => (
              <View
                key={id}
                style={[
                  local.pane,
                  slot.depth > firstOpen && !isStrip && local.paneDivider,
                  { width: isStrip ? 0 : slot.width },
                  isStrip && local.hidden,
                ]}
              >
                {pane}
                {notches.left.length > 0 && <PaneNotches parts={notches.left} side="left" />}
                {notches.right.length > 0 && <PaneNotches parts={notches.right} side="right" />}
              </View>
            );
            if (id === channelId)
              return wrap(
                <ChannelPane
                  channel={channel}
                  chrome={
                    <>
                      {expandButton(id)}
                      <FoldPaneButton label="Fold the channel" onPress={() => fold(id)} />
                    </>
                  }
                  client={client}
                  onOpenMission={onOpenMission}
                />,
              );
            if (id === starterId) {
              return wrap(
                <ErrandStarter
                  chrome={
                    <>
                      {expandButton(id)}
                      <FoldPaneButton label="Fold the errand" onPress={() => fold(id)} />
                    </>
                  }
                  client={client}
                  errands={threads.filter((thread) => thread.parentId !== null)}
                  onOpened={revealThread}
                  parent={data !== null && data.thread.id === quest ? data.thread : null}
                />,
              );
            }
            const threadId = id;
            const isFocused = !isParked && threadId === focusedId;
            return wrap(
              <View
                onPointerDown={() => setFocused(threadId)}
                style={[local.content, isFocused && paneCount > 1 && local.focused]}
              >
                <PaneThread
                  chrome={
                    <>
                      {threadId !== quest && quest !== undefined && (
                        <PaneButton glyph="+" label="New errand" onPress={() => startErrand(quest)} />
                      )}
                      {expandButton(threadId)}
                      <FoldPaneButton
                        label={threadId === quest ? "Fold the quest" : "Fold the errand"}
                        onPress={() => fold(threadId)}
                      />
                    </>
                  }
                  client={client}
                  missionId={missionId}
                  onOpenMission={onOpenMission}
                  onOpenThread={revealThread}
                  onStartErrand={() => startErrand(threadId)}
                  threadId={threadId}
                />
              </View>,
            );
          })}
        {available > 0 && resizers}
      </View>
    </OpenPanes.Provider>
  );
}

const local = StyleSheet.create({
  content: { flex: 1 },
  focused: { backgroundColor: colors.page },
  hidden: { display: "none" },
  pane: { backgroundColor: colors.page },
  paneDivider: { borderColor: colors.edge, borderLeftWidth: 1 },
  row: { backgroundColor: colors.page, flex: 1, flexDirection: "row" },
  toolbar: {
    alignItems: "flex-end",
    backgroundColor: colors.page,
    borderBottomWidth: 1,
    borderColor: colors.edge,
    paddingHorizontal: 8,
  },
});
