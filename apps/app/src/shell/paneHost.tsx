import { type MissionId, type ThreadId, type ThreadSummary, WorkspaceId } from "@outlore/contracts";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { listedErrandsOf } from "../conversation/errandRoster";
import { OpenPanes } from "../conversation/replyLine";
import { useShownThreadsRead } from "../conversation/useShownThreadsRead";
import type { ServiceClient } from "../foundation/client";
import { useIslandFrame } from "../foundation/islands";
import { listedMissions } from "../foundation/queries";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { ExpandPaneButton, FoldPaneButton } from "../ui/questHeaderButtons";
import { ChannelPane, type ChannelTabMemory, QuestStartFailure } from "./channelPane";
import { ErrandStarter } from "./errandStarter";
import { resizedWeights } from "./paneChain";
import { type PaneId, starterId } from "./paneIds";
import { paneNotchesOf } from "./paneNotches";
import { PaneResizer } from "./paneResizer";
import { PaneButton, PaneNotches } from "./paneStrip";
import { rememberPaneWeights } from "./railStorage";
import { ThreadSlot } from "./threadSlot";
import { noDragRegion } from "./topBar";
import { usePaneChain } from "./usePaneChain";
import { useStartQuest } from "./useStartQuest";
import { channelOf } from "./windowView";

/** How far from the window's right edge the Equal widths button sits in the Islands layout: past the Workshop button. */
const topBarEndReach = 42;

const noThreads: ReadonlyArray<ThreadSummary> = [];

/**
 * Shows the channel, quest and selected errand. An older nested errand uses the same third slot.
 * With no quest it shows the channel alone, so opening the first quest keeps the channel's pane mounted with its tab, scroll and queries.
 */
export const PaneHost = memo(function PaneHost({
  client,
  errandsRequest,
  listedChannel,
  missionId,
  isChannelOpen = false,
  isParked = false,
  onChannelOpen,
  onOpenErrand,
  onOpenMission,
  onOpenThread,
  openCount = 0,
  openThread,
  questsRequest,
  tabMemory,
}: {
  client: ServiceClient;
  errandsRequest: object | null;
  /** Whether the realm's channel was open when this quest opened: it then starts open beside the quest. */
  isChannelOpen?: boolean;
  /** Whether the Workshop covers the panes: they stay as they are, out of sight, and take no part in the details panel. */
  isParked?: boolean;
  /** The channel to show while no quest is open. */
  listedChannel?: { id: string | null; name: string } | undefined;
  /** The open quest, or null for the channel alone. */
  missionId: MissionId | null;
  /** Told whether the channel pane is open, so the next quest to open can keep it so. */
  onChannelOpen?: (isOpen: boolean) => void;
  /** Opens an errand of any quest, from the channel pane's History tab. */
  onOpenErrand: (missionId: MissionId, threadId: ThreadId) => void;
  onOpenMission: (missionId: MissionId) => void;
  /** Makes a thread the open one, which is the deepest pane of the chain. */
  onOpenThread: (threadId: ThreadId) => void;
  /** Incremented each time the owner opens a quest, so re-selecting a folded quest or switching while expanded reveals it without remounting the channel. */
  openCount?: number;
  /** The deepest thread of the chain, or null for the quest's own thread. */
  openThread: ThreadId | null;
  /** The channel pane's last tab, so the pane of the next quest to open starts on it. */
  tabMemory?: ChannelTabMemory | undefined;
  /** A request from the channel's own page to list its quests; each new object opens the Quests tab. */
  questsRequest?: object | null | undefined;
}) {
  const { data } = useServiceQuery(
    client,
    missionId === null ? null : { _tag: "ReadMission", missionId, threadId: openThread },
    `${missionId}:${openThread ?? "top"}`,
  );
  // The tree comes with the thread's read; while another thread loads, the previous chain stays on show.
  const { data: missionList } = useServiceQuery(client, listedMissions.request, listedMissions.key);
  const [loadedThreads, setThreads] = useState(data?.threads ?? noThreads);
  useEffect(() => {
    if (missionId === null) setThreads(noThreads);
    else if (data !== null) setThreads(data.threads);
  }, [data, missionId]);
  const threads = missionId === null ? noThreads : loadedThreads;
  // Resolve the quest's realm synchronously from the cached mission list so ChannelPane never flashes Borderlands while ReadMission loads.
  const listedMission = missionList?.missions.find((mission) => mission.id === missionId) ?? null;
  const hasChannelSource = missionId === null || listedMission !== null || data !== null;
  const workspaceId =
    missionId === null
      ? listedChannel?.id
      : listedMission !== null
        ? listedMission.workspaceId
        : data?.mission.workspaceId;
  const workspaceName =
    missionId === null
      ? listedChannel?.name
      : listedMission !== null
        ? listedMission.workspaceName
        : data?.mission.workspaceName;
  const resolvedChannel = useMemo(
    () => (hasChannelSource ? channelOf(workspaceId, workspaceName) : null),
    [hasChannelSource, workspaceId, workspaceName],
  );
  const lastChannel = useRef<{ id: string | null; name: string } | null>(null);
  if (resolvedChannel !== null) lastChannel.current = resolvedChannel;
  const fallbackChannel = useMemo(() => channelOf(void 0, void 0), []);
  const channel = resolvedChannel ?? lastChannel.current ?? fallbackChannel;
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
  } = usePaneChain({
    isChannelOpen,
    isStandalone: missionId === null,
    onChannelOpen,
    onOpenThread,
    openCount,
    openThread,
    questsRequest,
    threads,
  });
  // A conversation shown in a pane is read (CHG-0569): its replies, results and requests are no longer unread, and
  // rereading after each change follows the stream while it stays on show. Parked panes are out of sight, so wait.
  useShownThreadsRead(client, openIds, !isParked, data);
  const dragStart = useRef(slots);
  const latest = useRef(memory);
  latest.current = memory;
  const hasMultiplePanes = paneCount > 1;
  const paneControls = useCallback(
    (id: PaneId, foldLabel: string) =>
      hasMultiplePanes ? (
        <>
          <ExpandPaneButton onPress={() => expandPane(id)} />
          <FoldPaneButton label={foldLabel} onPress={() => fold(id)} />
        </>
      ) : null,
    [expandPane, fold, hasMultiplePanes],
  );
  const channelChrome = useMemo(() => paneControls("channel", "Fold the channel"), [paneControls]);
  const starterChrome = useMemo(() => paneControls(starterId, "Fold the errand"), [paneControls]);
  const starterErrands = useMemo(() => listedErrandsOf(threads), [threads]);
  const starterParent = data !== null && data.thread.id === quest ? data.thread : null;
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
  const missionIdRef = useRef(missionId);
  missionIdRef.current = missionId;
  const questRef = useRef(quest);
  questRef.current = quest;
  const onOpenMissionRef = useRef(onOpenMission);
  onOpenMissionRef.current = onOpenMission;
  const openChannelQuest = useCallback(
    (id: MissionId) => {
      if (id === missionIdRef.current && questRef.current !== undefined) revealPane(questRef.current);
      else onOpenMissionRef.current(id);
    },
    [revealPane],
  );
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
                    chrome={channelChrome}
                    client={client}
                    listRequest={listRequest?.id === id ? listRequest : void 0}
                    onOpenMission={openChannelQuest}
                    onOpenThread={onOpenErrand}
                    openMission={missionId ?? void 0}
                    tabMemory={tabMemory}
                  />
                  <QuestStartFailure failure={questStartFailure} />
                </>,
              );
            if (content.kind === "starter") {
              return wrap(
                <ErrandStarter
                  chrome={starterChrome}
                  client={client}
                  errands={starterErrands}
                  onOpened={revealThread}
                  parent={starterParent}
                />,
              );
            }
            // A quest's own panes wait for a quest to open.
            if (missionId === null) return null;
            const threadId = content.id;
            const isQuest = content.kind === "quest";
            return wrap(
              <ThreadSlot
                client={client}
                expandPane={expandPane}
                fold={fold}
                hasMultiplePanes={hasMultiplePanes}
                isFocused={!isParked && threadId === focusedId}
                isQuest={isQuest}
                listRequest={listRequest?.id === id ? listRequest : isQuest ? (errandsRequest ?? void 0) : void 0}
                missionId={missionId}
                onOpenMission={onOpenMission}
                questId={quest ?? null}
                revealThread={revealThread}
                setFocused={setFocused}
                startErrand={startErrand}
                threadId={threadId}
              />,
            );
          })}
        {available > 0 && resizers}
      </View>
    </OpenPanes.Provider>
  );
});

const local = StyleSheet.create({
  // An island's own box: the layout's island style adds its color, hairline, corners, and shadow.
  card: { flex: 1 },
  hidden: { display: "none" },
  pane: { backgroundColor: colors.page },
  paneDivider: { borderColor: colors.edge, borderLeftWidth: 1 },
  row: { flex: 1, flexDirection: "row" },
  rowFlat: { backgroundColor: colors.page },
  toolbar: { alignItems: "flex-end", paddingHorizontal: 8 },
  toolbarFlat: { backgroundColor: colors.page, borderBottomWidth: 1, borderColor: colors.edge },
  toolbarIslands: { position: "absolute", top: -33, zIndex: 5 },
});
