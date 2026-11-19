import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import { OpenPanes } from "../conversation/replyLine";
import type { ServiceClient } from "../foundation/client";
import { QuestTabButtonContext } from "../foundation/shellContext";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ChronicleContext, ChroniclePane, chronicleId } from "./chronicle";
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

/** A slot of the chain: the Chronicle, or one thread of the quest. */
type PaneId = ThreadId | typeof chronicleId;

/**
 * A quest as a chain of panes (CHG-0561): its own conversation, then an errand beside it, then that errand's errand,
 * up to four at once, the earlier ones folded to strips beyond that. The chain is the path in the quest's tree to the
 * open thread, so opening a reply line drops the panes to its right, closing a pane drops it with what hangs from it,
 * and the sidebar's choice of an errand builds its whole chain. The pane pressed last is the one the details panel shows.
 */
export function PaneHost({
  client,
  missionId,
  isParked = false,
  onCloseMission,
  onOpenMission,
  onOpenThread,
  openThread,
}: {
  client: ServiceClient;
  /** Whether the Workshop covers the panes: they stay as they are, out of sight, and take no part in the details panel. */
  isParked?: boolean;
  missionId: MissionId;
  /** Closes the quest, which leaves the Chronicle alone: the quest's own pane is the one that closes. */
  onCloseMission: () => void;
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
  // The Chronicle is the first slot of the chain: the first level, ahead of the quest (CHG-0564). The chain's rules know
  // nothing of what a slot holds, so the channel level of a realm can stand between them later.
  const chronicle = useContext(ChronicleContext);
  const hasChronicle = chronicle !== null;
  const fullChain = useMemo<Array<PaneId>>(
    () => (hasChronicle ? [chronicleId, ...chain] : chain),
    [chain, hasChronicle],
  );
  const [memory, setMemory] = useState<PaneMemory<PaneId>>(() => ({
    ...emptyPaneMemory<PaneId>(),
    weights: readPaneWeights(),
  }));
  // A folded Chronicle is the frame's to remember, since it stays across every screen.
  const isChronicleFolded = chronicle !== null && !chronicle.isOpen;
  const shownMemory = useMemo(
    () => (isChronicleFolded ? foldedPane(memory, chronicleId) : memory),
    [memory, isChronicleFolded],
  );
  const [focused, setFocused] = useState<ThreadId | null>(null);
  const [available, setAvailable] = useState(0);
  // Opening a thread focuses its pane; the folds of panes that left the chain are forgotten.
  useEffect(() => {
    setFocused(deepest);
    setMemory((current) => prunedMemory(current, fullChain));
  }, [deepest, fullChain]);
  const slots = useMemo(
    () => layoutOf({ available, chain: fullChain, memory: shownMemory }),
    [available, fullChain, shownMemory],
  );
  const openIds = useMemo(
    () => new Set(slots.flatMap((slot) => (slot.kind === "pane" && slot.id !== chronicleId ? [slot.id] : []))),
    [slots],
  );
  const paneCount = slots.filter((slot) => slot.kind === "pane").length;
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
  // Parked out of sight the row has no width: the panes keep the last they had, so they come back as they were.
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0) setAvailable(width);
  };
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
            if (slot.kind === "strip") {
              const summary = slot.id === chronicleId ? undefined : summaryOf(slot.id);
              return (
                <PaneStrip
                  key={slot.id}
                  onReveal={() => {
                    setMemory((current) => revealedPane(current, slot.id));
                    if (slot.id === chronicleId) chronicle?.setOpen(true);
                  }}
                  state={summary?.state ?? "Idle"}
                  title={slot.id === chronicleId ? "Chronicle" : (summary?.title ?? "")}
                />
              );
            }
            if (slot.id === chronicleId)
              return (
                <View accessibilityLabel="Chronicle" key={slot.id} style={[local.pane, { width: slot.width }]}>
                  <ChroniclePane
                    chrome={
                      <PaneButton glyph="‹" label="Fold the Chronicle" onPress={() => chronicle?.setOpen(false)} />
                    }
                  />
                </View>
              );
            const threadId = slot.id;
            const parentId = fullChain[slot.depth - 1];
            const isFocused = !isParked && threadId === focusedId;
            return (
              <View
                key={threadId}
                onPointerDown={() => {
                  pointer.current = { at: Date.now(), followedBefore: focusedId };
                  setFocused(threadId);
                }}
                style={[local.pane, { width: slot.width }, isFocused && paneCount > 1 && local.focused]}
              >
                <PaneTab
                  isFocused={isFocused}
                  onFocus={() => setFocused(threadId)}
                  wasFollowed={() =>
                    wasFollowedAtPress({
                      followedNow: focusedId,
                      id: threadId,
                      now: Date.now(),
                      pointer: pointer.current,
                    })
                  }
                >
                  <PaneThread
                    chrome={
                      <>
                        {threadId === deepest && paneCount > 1 && (
                          <PaneButton glyph="↔" label="Equal widths" onPress={equalize} />
                        )}
                        {threadId !== deepest && (
                          <PaneButton
                            glyph="‹"
                            label="Fold the pane"
                            onPress={() => setMemory((current) => foldedPane(current, threadId))}
                          />
                        )}
                        {parentId === chronicleId && (
                          <PaneButton glyph="✕" label="Close the quest" onPress={onCloseMission} />
                        )}
                        {parentId !== undefined && parentId !== chronicleId && (
                          <PaneButton glyph="✕" label="Close the pane" onPress={() => onOpenThread(parentId)} />
                        )}
                      </>
                    }
                    client={client}
                    isFocused={isFocused}
                    missionId={missionId}
                    onOpenMission={onOpenMission}
                    onOpenThread={onOpenThread}
                    threadId={threadId}
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
