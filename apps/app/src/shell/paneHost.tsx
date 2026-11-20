import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import { OpenPanes } from "../conversation/replyLine";
import type { ServiceClient } from "../foundation/client";
import { QuestTabButtonContext } from "../foundation/shellContext";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ChannelPane, channelId } from "./channelPane";
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

/** One channel slot and up to two threads of the quest. */
type PaneId = ThreadId | typeof channelId;

/** Shows the channel, quest and selected errand. An older nested errand uses the same third slot. */
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
  /** Closes the quest and returns to its channel. */
  onCloseMission: (channel: { id: import("@outlore/contracts").WorkspaceId | null; name: string }) => void;
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
    return chosen.length === 0 ? [] : [channelId, ...chosen];
  }, [quest, deepest]);
  const channel = { id: data?.mission.workspaceId ?? null, name: data?.mission.workspaceName ?? "Borderlands" };
  const [memory, setMemory] = useState<PaneMemory<PaneId>>(() => ({
    ...emptyPaneMemory<PaneId>(),
    weights: readPaneWeights(),
  }));
  const [focused, setFocused] = useState<ThreadId | null>(null);
  const [available, setAvailable] = useState(0);
  // Opening a thread focuses its pane; the folds of panes that left the chain are forgotten.
  useEffect(() => {
    setFocused(deepest);
    setMemory((current) => prunedMemory(current, fullChain));
  }, [deepest, fullChain]);
  const slots = useMemo(() => layoutOf({ available, chain: fullChain, memory }), [available, fullChain, memory]);
  const openIds = useMemo(
    () => new Set(slots.flatMap((slot) => (slot.kind === "pane" && slot.id !== channelId ? [slot.id] : []))),
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
              const summary = slot.id === channelId ? undefined : summaryOf(slot.id);
              return (
                <PaneStrip
                  key={slot.id}
                  onReveal={() => {
                    setMemory((current) => revealedPane(current, slot.id));
                  }}
                  state={summary?.state ?? "Idle"}
                  title={slot.id === channelId ? channel.name : (summary?.title ?? "")}
                />
              );
            }
            if (slot.id === channelId)
              return (
                <View accessibilityLabel={channel.name} key={slot.id} style={[local.pane, { width: slot.width }]}>
                  <ChannelPane
                    channel={channel}
                    chrome={
                      <PaneButton
                        glyph="‹"
                        label="Fold the channel"
                        onPress={() => setMemory((current) => foldedPane(current, channelId))}
                      />
                    }
                    client={client}
                    onOpenMission={onOpenMission}
                  />
                </View>
              );
            const threadId = slot.id;
            const parentId = threadId === quest ? channelId : path.at(-2);
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
                        {parentId === channelId && (
                          <PaneButton glyph="✕" label="Close the quest" onPress={() => onCloseMission(channel)} />
                        )}
                        {parentId !== undefined && parentId !== channelId && (
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
