import type { MissionId, ThreadId } from "@outlore/contracts";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { PaneThread } from "../conversation/paneThread";
import { OpenPanes } from "../conversation/replyLine";
import type { ServiceClient } from "../foundation/client";
import { allMissions } from "../foundation/queries";
import { realmMarkOf } from "../foundation/realmMark";
import { colors } from "../foundation/theme";
import { useServiceQuery } from "../foundation/useServiceQuery";
import { FoldPaneButton } from "../ui/questHeaderButtons";
import { ChannelPane, channelId } from "./channelPane";
import { childNotchesOf, urgencyOf } from "./childNotches";
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
import { type NotchKind, type NotchPart, notchWidth, PaneButton, PaneNotches } from "./paneStrip";
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
  const { data: missionList } = useServiceQuery(client, allMissions.request, allMissions.key);
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
  // A "+N" notch asks a pane to open its list of children; a new object each press, so a second press asks again.
  const [listRequest, setListRequest] = useState<{ id: PaneId } | null>(null);
  // Opening a thread focuses its pane; the folds of panes that left the chain are forgotten.
  useEffect(() => {
    setFocused(deepest);
    setMemory((current) => prunedMemory(current, fullChain));
    setExpanded((current) => (current !== null && fullChain.includes(current) ? current : null));
  }, [deepest, fullChain]);
  // The starter is folded again whenever another quest opens: its pane stays in the chain from one quest to the next, so
  // the pressed-open memory of the last quest would otherwise carry over to the new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the quest opening is what resets the starter.
  useEffect(() => {
    setMemory((current) =>
      current.shown.has(starterId)
        ? { ...current, shown: new Set([...current.shown].filter((each) => each !== starterId)) }
        : current,
    );
    setExpanded((current) => (current === starterId ? null : current));
  }, [quest]);
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
  // A conversation shown in a pane is read (CHG-0569): its replies, results and requests are no longer unread, and
  // rereading after each change follows the stream while it stays on show. Parked panes are out of sight, so wait.
  const shownKey = [...openIds].join("\0");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key names the open panes whose read state changes.
  useEffect(() => {
    if (isParked) return;
    for (const id of openIds) client.request({ _tag: "MarkThreadRead", threadId: id }).catch(() => {});
  }, [client, isParked, shownKey, data]);
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
    // Opening a thread, from a notch or a list, exits the expanded layout: its pane is revealed instead.
    setExpanded(null);
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
  const isExpandedPane = (id: PaneId) => paneCount === 1 && openSlots[0]?.id === id;
  // A pane in full view has nothing to fold into: its fold button is not shown.
  const foldButton = (id: PaneId, label: string) =>
    isExpandedPane(id) ? null : <FoldPaneButton label={label} onPress={() => fold(id)} />;
  const expandButton = (id: PaneId) => {
    const isExpanded = isExpandedPane(id);
    return (
      <PaneButton
        glyph={isExpanded ? "⊡" : "⛶"}
        label={isExpanded ? "Restore pane layout" : "Expand pane"}
        onPress={() => {
          if (id !== channelId && id !== starterId) setFocused(id);
          if (id === starterId && !isExpanded) setMemory((current) => revealedPane(current, id));
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
  // The dot of a folded pane: a realm shows the mark derived from its quests (it has no status), the quest its own
  // status, and an errand its status rolled up with the errands beneath it.
  const notchStateOf = (id: PaneId, summary: ReturnType<typeof summaryOf>): NotchPart["state"] => {
    if (id === channelId)
      return realmMarkOf(
        (missionList?.missions ?? []).filter((mission) => mission.workspaceId === channel.id).map(({ state }) => state),
      );
    if (id === starterId) return null;
    if (id === quest)
      return missionList?.missions.find((mission) => mission.id === missionId)?.state ?? summary?.shownState ?? null;
    return summary?.shownState ?? null;
  };
  const notchOf = (id: PaneId): NotchPart | null => {
    const summary = id === channelId || id === starterId ? undefined : summaryOf(id);
    // An inactive errand remains readable in its pane or from the Errands tab, but has no edge shortcut.
    if (id !== quest && summary !== undefined && (summary.isArchived || urgencyOf(summary.shownState) === null))
      return null;
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
      isNew: id === starterId,
      kind,
      onReveal: () => {
        setExpanded(null);
        if (id !== channelId && id !== starterId) setFocused(id);
        setMemory((current) => revealedPane(current, id));
      },
      state: notchStateOf(id, summary),
      title: id === channelId ? channel.name : id === starterId ? "New errand" : (summary?.title ?? ""),
    };
  };
  // The active errands of the quest and the active quests of the realm that have no pane or notch yet, as notches on the
  // right edge of the quest's or the realm's own pane.
  const childNotchesOfPane = (id: PaneId): Array<NotchPart> => {
    const isChannel = id === channelId;
    if (!isChannel && id !== quest) return [];
    const parts: Array<NotchPart> = [];
    let more: { count: number; state: NotchPart["state"] } | null;
    if (isChannel) {
      const result = childNotchesOf(
        (missionList?.missions ?? []).filter((mission) => mission.workspaceId === channel.id),
        new Set<string>([missionId]),
      );
      more = result.more;
      for (const child of result.shown) {
        const title = missionList?.missions.find((mission) => mission.id === child.id)?.title ?? "";
        parts.push({
          id: `child:${child.id}`,
          kind: "quest",
          onReveal: () => onOpenMission(child.id),
          state: child.state,
          title,
        });
      }
    } else {
      const result = childNotchesOf(
        threads.filter((thread) => thread.parentId !== null).map((thread) => ({ ...thread, state: thread.shownState })),
        new Set<string>(fullChain),
      );
      more = result.more;
      for (const child of result.shown) {
        const title = threads.find((thread) => thread.id === child.id)?.title ?? "";
        parts.push({
          id: `child:${child.id}`,
          kind: "errand",
          onReveal: () => revealThread(child.id),
          state: child.state,
          title,
        });
      }
    }
    if (more !== null)
      parts.push({
        count: more.count,
        id: `more:${id}`,
        kind: "more",
        onReveal: () => setListRequest({ id }),
        state: more.state,
        title: `Show ${more.count} more ${isChannel ? "quests" : "errands"}`,
      });
    return parts;
  };
  // A folded pane is a notch on the edge of an open pane: the left edge of the next one, or the right edge of the last.
  const notchesAt = (depth: number): { left: Array<NotchPart>; right: Array<NotchPart> } => {
    const left: Array<NotchPart> = [];
    for (let each = depth - 1; slots[each]?.kind === "strip"; each -= 1) {
      const id = slots[each]?.id;
      const notch = id === undefined ? null : notchOf(id);
      if (notch !== null) left.unshift(notch);
    }
    const right: Array<NotchPart> = [];
    const own = slots[depth]?.id;
    // Only the last open pane has a right edge: it lists its folded panes, then its own children (a realm's quests, a
    // quest's errands). A pane with another open pane after it shows none, since that pane already stands for them.
    if (slots.slice(depth + 1).every((slot) => slot.kind === "strip")) {
      for (let each = depth + 1; slots[each]?.kind === "strip"; each += 1) {
        const id = slots[each]?.id;
        const notch = id === undefined ? null : notchOf(id);
        if (notch !== null) right.push(notch);
      }
      // The realm's edge lists quests only: the errands folded after its quest are not its own, so they show no notch there.
      const shownRight = own === channelId ? right.filter((part) => part.kind === "quest") : right;
      return { left, right: [...shownRight, ...(own === undefined ? [] : childNotchesOfPane(own))] };
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
            // Between two open panes the notches of the folded panes sit across the line: half in each pane. Against
            // the edge of the row they sit inside the pane.
            const isStraddling =
              notches.left.length > 0 && slots.slice(0, slot.depth).some((before) => before.kind === "pane");
            const nextOpen = isStrip ? undefined : slots.slice(slot.depth + 1).find((after) => after.kind === "pane");
            const nextStraddles = nextOpen !== undefined && notchesAt(nextOpen.depth).left.length > 0;
            const wrap = (pane: ReactNode) => (
              <View
                key={id}
                style={[
                  local.pane,
                  slot.depth > firstOpen && !isStrip && local.paneDivider,
                  { width: isStrip ? 0 : slot.width },
                  notches.left.length > 0 && { paddingLeft: isStraddling ? notchWidth / 2 : notchWidth },
                  (notches.right.length > 0 || nextStraddles) && {
                    paddingRight: notches.right.length > 0 ? notchWidth : notchWidth / 2,
                  },
                  isStrip && local.hidden,
                ]}
              >
                {pane}
                {notches.left.length > 0 && (
                  <PaneNotches isStraddling={isStraddling} parts={notches.left} side="left" />
                )}
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
                      {foldButton(id, "Fold the channel")}
                    </>
                  }
                  client={client}
                  listRequest={listRequest?.id === id ? listRequest : undefined}
                  onOpenMission={onOpenMission}
                />,
              );
            if (id === starterId) {
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
                      {expandButton(threadId)}
                      {foldButton(threadId, threadId === quest ? "Fold the quest" : "Fold the errand")}
                    </>
                  }
                  client={client}
                  listRequest={listRequest?.id === id ? listRequest : undefined}
                  missionId={missionId}
                  onNewErrand={threadId !== quest && quest !== undefined ? () => startErrand(quest) : undefined}
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
