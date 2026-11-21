import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import { OpenPanes } from "../conversation/replyLine";
import { useShownThreadsRead } from "../conversation/useShownThreadsRead";
import type { ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { FoldPaneButton } from "../ui/questHeaderButtons";
import { ChannelPane } from "./channelPane";
import { ErrandStarter } from "./errandStarter";
import { resizedWeights } from "./paneChain";
import type { PaneId } from "./paneIds";
import { paneNotchesOf } from "./paneNotches";
import { PaneResizer } from "./paneResizer";
import { PaneButton, PaneNotches } from "./paneStrip";
import { rememberPaneWeights } from "./railStorage";
import { usePaneChain } from "./usePaneChain";
import { channelOf } from "./windowView";

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
  const { data: missionList } = useServiceQuery(client, allMissions.request, allMissions.key);
  const [threads, setThreads] = useState(data?.threads ?? []);
  useEffect(() => {
    if (data !== null) setThreads(data.threads);
  }, [data]);
  const channel = channelOf(data?.mission.workspaceId, data?.mission.workspaceName);
  const {
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
    openList,
    setMemory,
    slots,
    startErrand,
    toggleExpanded,
  } = usePaneChain(threads, openThread, onOpenThread);
  // A conversation shown in a pane is read (CHG-0569): its replies, results and requests are no longer unread, and
  // rereading after each change follows the stream while it stays on show. Parked panes are out of sight, so wait.
  useShownThreadsRead(client, openIds, !isParked, data);
  const dragStart = useRef(slots);
  const latest = useRef(memory);
  latest.current = memory;
  // A pane in full view has nothing to fold into: its fold button is not shown.
  const foldButton = (id: PaneId, label: string) =>
    isExpandedPane(id) ? null : <FoldPaneButton label={label} onPress={() => fold(id)} />;
  const expandButton = (id: PaneId) => {
    const isExpanded = isExpandedPane(id);
    return (
      <PaneButton
        glyph={isExpanded ? "⊡" : "⛶"}
        label={isExpanded ? "Restore pane layout" : "Expand pane"}
        onPress={() => toggleExpanded(id)}
      />
    );
  };
  // Parked out of sight the row has no width: the panes keep the last they had, so they come back as they were.
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0) setAvailable(width);
  };
  const notchesAt = paneNotchesOf({
    channel,
    fullChain,
    missionId,
    missions: missionList?.missions ?? [],
    onOpenMission,
    openList,
    revealPane,
    revealThread,
    slots,
    threads,
  });
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
            const { content, id } = slot;
            const isStrip = slot.kind === "strip";
            const notches = notchesAt(slot.depth);
            const wrap = (pane: ReactNode) => (
              <View
                key={id}
                style={[
                  local.pane,
                  slot.depth > firstOpen && !isStrip && local.paneDivider,
                  { width: isStrip ? 0 : slot.width },
                  { paddingLeft: notches.paddingLeft, paddingRight: notches.paddingRight },
                  isStrip && local.hidden,
                ]}
              >
                {pane}
                {notches.left.length > 0 && (
                  <PaneNotches isStraddling={notches.isStraddling} parts={notches.left} side="left" />
                )}
                {notches.right.length > 0 && <PaneNotches parts={notches.right} side="right" />}
              </View>
            );
            if (content.kind === "channel")
              return wrap(
                <ChannelPane
                  channel={channel}
                  chrome={
                    <>
                      {expandButton(id)}
                      {foldButton(id, "Fold the channel")}
                    </>
                  }
                  client={client}
                  listRequest={listRequest?.id === id ? listRequest : undefined}
                  onOpenMission={onOpenMission}
                />,
              );
            if (content.kind === "starter") {
              return wrap(
                <ErrandStarter
                  chrome={
                    <>
                      {expandButton(id)}
                      {foldButton(id, "Fold the errand")}
                    </>
                  }
                  client={client}
                  errands={threads.filter((thread) => thread.parentId !== null && thread.isArchived !== true)}
                  onOpened={revealThread}
                  parent={data !== null && data.thread.id === quest ? data.thread : null}
                />,
              );
            }
            const threadId = content.id;
            const isFocused = !isParked && threadId === focusedId;
            return wrap(
              <View
                onPointerDown={() => setFocused(threadId)}
                style={[local.content, isFocused && paneCount > 1 && local.focused]}
              >
                <PaneThread
                  chrome={
                    <>
                      {expandButton(threadId)}
                      {foldButton(threadId, content.kind === "quest" ? "Fold the quest" : "Fold the errand")}
                    </>
                  }
                  client={client}
                  listRequest={listRequest?.id === id ? listRequest : undefined}
                  missionId={missionId}
                  onNewErrand={content.kind === "errand" && quest !== undefined ? () => startErrand(quest) : undefined}
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
