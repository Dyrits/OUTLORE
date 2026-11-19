import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import { OpenPanes } from "../conversation/replyLine";
import type { ServiceClient } from "../foundation/client";
import { QuestTabButtonContext } from "../foundation/shellContext";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import {
  chainOf,
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
import { PaneButton, PaneStrip } from "./paneStrip";
import { type PanePointer, paneIconPress, wasFollowedAtPress } from "./questTab";
import { readPaneWeights, rememberPaneWeights } from "./railStorage";

/**
 * The panel's button in a pane's header. Pressed in a pane that is not the focused one, it moves the panel there, opening
 * it if it was shut, rather than closing it. This reads the frame's context in a component of its own: the frame draws
 * again whenever a pane hands it a panel, and a host that read it would draw its panes again each time, and so loop.
 */
function PaneTab({
  children,
  isFocused,
  onFocus,
  wasFollowed,
}: {
  children: ReactNode;
  isFocused: boolean;
  onFocus: () => void;
  /** Whether the panel followed this pane when the press began: the pane takes focus as the pointer goes down. */
  wasFollowed: () => boolean;
}) {
  const questTab = useContext(QuestTabButtonContext);
  const paneTab =
    questTab === null
      ? null
      : {
          isOpen: questTab.isOpen && isFocused,
          onPress: () => {
            const action = paneIconPress({ isOpen: questTab.isOpen, wasFollowed: wasFollowed() });
            onFocus();
            if (action === "toggle") questTab.onPress();
          },
        };
  return <QuestTabButtonContext.Provider value={paneTab}>{children}</QuestTabButtonContext.Provider>;
}

/**
 * A quest as a chain of panes (CHG-0561): its own conversation, then an errand beside it, then that errand's errand,
 * up to four at once, the earlier ones folded to strips beyond that. The chain is the path in the quest's tree to the
 * open thread, so opening a reply line drops the panes to its right, closing a pane drops it with what hangs from it,
 * and the sidebar's choice of an errand builds its whole chain. The pane pressed last is the one the details panel shows.
 */
export function PaneHost({
  client,
  missionId,
  onOpenMission,
  onOpenThread,
  openThread,
}: {
  client: ServiceClient;
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
  const chain = useMemo(() => chainOf(threads, openThread), [threads, openThread]);
  const deepest = chain.at(-1) ?? null;
  const [memory, setMemory] = useState<PaneMemory<ThreadId>>(() => ({
    ...emptyPaneMemory<ThreadId>(),
    weights: readPaneWeights(),
  }));
  const [focused, setFocused] = useState<ThreadId | null>(null);
  const [available, setAvailable] = useState(0);
  // Opening a thread focuses its pane; the folds of panes that left the chain are forgotten.
  useEffect(() => {
    setFocused(deepest);
    setMemory((current) => prunedMemory(current, chain));
  }, [deepest, chain]);
  const slots = useMemo(() => layoutOf({ available, chain, memory }), [available, chain, memory]);
  const openIds = useMemo(() => new Set(slots.filter((slot) => slot.kind === "pane").map((slot) => slot.id)), [slots]);
  const dragStart = useRef(slots);
  const latest = useRef(memory);
  latest.current = memory;
  const focusedId = focused !== null && openIds.has(focused) ? focused : deepest;
  // Where the panel stood when the pointer last went down in a pane, for the press on the icon that follows.
  const pointer = useRef<PanePointer | null>(null);
  const summaryOf = (id: ThreadId) => threads.find((thread) => thread.id === id);
  // Every open pane gets the same share again, and the dragged shares are forgotten with the memory of them.
  const equalize = () => {
    setMemory(equalizedPanes);
    rememberPaneWeights([]);
  };
  const onLayout = (event: LayoutChangeEvent) => setAvailable(Math.floor(event.nativeEvent.layout.width));
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
      <View onLayout={onLayout} style={local.row}>
        {available > 0 &&
          slots.map((slot) => {
            const summary = summaryOf(slot.id);
            if (slot.kind === "strip")
              return (
                <PaneStrip
                  key={slot.id}
                  onReveal={() => setMemory((current) => revealedPane(current, slot.id))}
                  state={summary?.state ?? "Idle"}
                  title={summary?.title ?? ""}
                />
              );
            const parentId = chain[slot.depth - 1];
            const isFocused = slot.id === focusedId;
            return (
              <View
                key={slot.id}
                onPointerDown={() => {
                  pointer.current = { at: Date.now(), followedBefore: focusedId };
                  setFocused(slot.id);
                }}
                style={[local.pane, { width: slot.width }, isFocused && slots.length > 1 && local.focused]}
              >
                <PaneTab
                  isFocused={isFocused}
                  onFocus={() => setFocused(slot.id)}
                  wasFollowed={() =>
                    wasFollowedAtPress({
                      followedNow: focusedId,
                      id: slot.id,
                      now: Date.now(),
                      pointer: pointer.current,
                    })
                  }
                >
                  <PaneThread
                    chrome={
                      <>
                        {slot.id === deepest && openIds.size > 1 && (
                          <PaneButton glyph="↔" label="Equal widths" onPress={equalize} />
                        )}
                        {slot.id !== deepest && (
                          <PaneButton
                            glyph="‹"
                            label="Fold the pane"
                            onPress={() => setMemory((current) => foldedPane(current, slot.id))}
                          />
                        )}
                        {parentId !== undefined && (
                          <PaneButton glyph="✕" label="Close the pane" onPress={() => onOpenThread(parentId)} />
                        )}
                      </>
                    }
                    client={client}
                    isFocused={isFocused}
                    missionId={missionId}
                    onOpenMission={onOpenMission}
                    onOpenThread={onOpenThread}
                    threadId={slot.id}
                  />
                </PaneTab>
              </View>
            );
          })}
        {available > 0 && resizers}
      </View>
    </OpenPanes.Provider>
  );
}

const local = StyleSheet.create({
  focused: { backgroundColor: colors.page },
  pane: { backgroundColor: colors.page, borderColor: colors.edge, borderLeftWidth: 1 },
  row: { backgroundColor: colors.page, flex: 1, flexDirection: "row" },
});
