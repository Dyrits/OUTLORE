import { type MissionId, type ThreadId, WorkspaceId } from "@outlore/contracts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import { OpenPanes } from "../conversation/replyLine";
import { useShownThreadsRead } from "../conversation/useShownThreadsRead";
import type { ServiceClient } from "../foundation/client";
import { useIslandFrame } from "../foundation/islands";
import { listedMissions } from "../foundation/queries";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ExpandPaneButton, FoldPaneButton } from "../ui/questHeaderButtons";
import { ChannelPane, QuestStartFailure } from "./channelPane";
import { ErrandStarter } from "./errandStarter";
import { resizedWeights } from "./paneChain";
import type { PaneId } from "./paneIds";
import { paneNotchesOf } from "./paneNotches";
import { PaneResizer } from "./paneResizer";
import { PaneButton, PaneNotches } from "./paneStrip";
import { rememberPaneWeights } from "./railStorage";
import { noDragRegion } from "./topBar";
import { usePaneChain } from "./usePaneChain";
import { useStartQuest } from "./useStartQuest";
import { channelOf } from "./windowView";

/** How far from the window's right edge the Equal widths button sits in the Islands layout: past the Workshop button. */
const topBarEndReach = 42;

/** Shows the channel, quest and selected errand. An older nested errand uses the same third slot. */
export function PaneHost({
  client,
  errandsRequest,
  missionId,
  isChannelOpen = false,
  isParked = false,
  onChannelOpen,
  onOpenMission,
  onOpenThread,
  openThread,
}: {
  client: ServiceClient;
  errandsRequest: object | null;
  /** Whether the realm's channel was open when this quest opened: it then starts open beside the quest. */
  isChannelOpen?: boolean;
  /** Whether the Workshop covers the panes: they stay as they are, out of sight, and take no part in the details panel. */
  isParked?: boolean;
  missionId: MissionId;
  /** Told whether the channel pane is open, so the next quest to open can keep it so. */
  onChannelOpen?: (isOpen: boolean) => void;
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
  const { data: missionList } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const [threads, setThreads] = useState(data?.threads ?? []);
  useEffect(() => {
    if (data !== null) setThreads(data.threads);
  }, [data]);
  const channel = channelOf(data?.mission.workspaceId, data?.mission.workspaceName);
  const { failure: questStartFailure, start: startQuest } = useStartQuest(
    client,
    channel.id === null ? null : WorkspaceId.make(channel.id),
    onOpenMission,
  );
  // In the Islands layout every open pane is a card of its own with `gap` between them (CHG-0672).
  const islands = useIslandFrame();
  const gap = islands?.gap ?? 0;
  const {
    available,
    equalize,
    expandPane,
    focusedId,
    fold,
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
  } = usePaneChain(threads, openThread, onOpenThread, isChannelOpen, onChannelOpen);
  // A conversation shown in a pane is read (CHG-0569): its replies, results and requests are no longer unread, and
  // rereading after each change follows the stream while it stays on show. Parked panes are out of sight, so wait.
  useShownThreadsRead(client, openIds, !isParked, data);
  const dragStart = useRef(slots);
  const latest = useRef(memory);
  latest.current = memory;
  const paneControls = (id: PaneId, foldLabel: string) =>
    paneCount > 1 ? (
      <>
        <ExpandPaneButton onPress={() => expandPane(id)} />
        <FoldPaneButton label={foldLabel} onPress={() => fold(id)} />
      </>
    ) : null;
  // Parked out of sight the row has no width: the panes keep the last they had, so they come back as they were.
  const onLayout = (event: LayoutChangeEvent) => {
    const width = Math.floor(event.nativeEvent.layout.width);
    if (width > 0) setAvailable(width);
  };
  const notchesAt = paneNotchesOf({
    channel,
    gap,
    missionId,
    missions: missionList?.missions ?? [],
    openList,
    revealPane,
    slots,
    startErrand: data?.mission.ritual == null ? startErrand : null,
    startQuest,
    threads,
  });
  const openChannelQuest = (id: MissionId) => {
    if (id === missionId && quest !== undefined) revealPane(quest);
    else onOpenMission(id);
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
        left={edge - gap / 2}
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
        <View
          style={
            islands === null
              ? [local.toolbar, local.toolbarFlat]
              : // Over the top bar's empty middle, beside the Workshop button, so the islands all start at one height.
                [local.toolbarIslands, { right: topBarEndReach - gap }, noDragRegion]
          }
        >
          <PaneButton glyph="↔" label="Equal widths" onPress={equalize} />
        </View>
      )}
      {/* Each open pane's room ends in a gap, the last one's too, which the row's negative margin pushes past its end. */}
      <View onLayout={onLayout} style={[local.row, islands === null ? local.rowFlat : { marginRight: -gap }]}>
        {available > 0 &&
          slots.map((slot) => {
            const { content, id } = slot;
            const isStrip = slot.kind === "strip";
            const notches = notchesAt(slot.depth);
            const notchPadding = { paddingLeft: notches.paddingLeft, paddingRight: notches.paddingRight };
            const wrap = (pane: ReactNode) => (
              <View
                key={id}
                style={[
                  islands === null && local.pane,
                  islands === null && slot.depth > firstOpen && !isStrip && local.paneDivider,
                  { width: isStrip ? 0 : slot.width },
                  islands === null ? notchPadding : { paddingRight: gap },
                  isStrip && local.hidden,
                ]}
              >
                {islands === null ? pane : <View style={[local.card, islands.island, notchPadding]}>{pane}</View>}
                {notches.left.length > 0 && (
                  <PaneNotches gap={gap} isStraddling={notches.isStraddling} parts={notches.left} side="left" />
                )}
                {notches.right.length > 0 && <PaneNotches gap={gap} parts={notches.right} side="right" />}
              </View>
            );
            if (content.kind === "channel")
              return wrap(
                <>
                  <ChannelPane
                    channel={channel}
                    chrome={paneControls(id, "Fold the channel")}
                    client={client}
                    listRequest={listRequest?.id === id ? listRequest : undefined}
                    onOpenMission={openChannelQuest}
                    openMission={missionId}
                  />
                  <QuestStartFailure failure={questStartFailure} />
                </>,
              );
            if (content.kind === "starter") {
              return wrap(
                <ErrandStarter
                  chrome={paneControls(id, "Fold the errand")}
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
                  chrome={paneControls(id, content.kind === "quest" ? "Fold the quest" : "Fold the errand")}
                  client={client}
                  listRequest={
                    listRequest?.id === id
                      ? listRequest
                      : content.kind === "quest"
                        ? (errandsRequest ?? void 0)
                        : void 0
                  }
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
  // An island's own box: the layout's island style adds its color, hairline, corners, and shadow.
  card: { flex: 1 },
  content: { flex: 1 },
  focused: { backgroundColor: colors.page },
  hidden: { display: "none" },
  pane: { backgroundColor: colors.page },
  paneDivider: { borderColor: colors.edge, borderLeftWidth: 1 },
  row: { flex: 1, flexDirection: "row" },
  rowFlat: { backgroundColor: colors.page },
  toolbar: { alignItems: "flex-end", paddingHorizontal: 8 },
  toolbarFlat: { backgroundColor: colors.page, borderBottomWidth: 1, borderColor: colors.edge },
  toolbarIslands: { position: "absolute", top: -33, zIndex: 5 },
});
