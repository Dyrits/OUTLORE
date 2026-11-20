import type { MissionId, MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { realmMarkOf } from "../foundation/realmMark";
import { type ChildNotch, childNotchesOf, urgencyOf } from "./childNotches";
import type { PaneSlot } from "./paneChain";
import { channelId, isThreadPane, type PaneId, starterId } from "./paneIds";
import type { NotchPart } from "./paneStrip";

/** Builds the ranked child shortcuts and their overflow shortcut. */
export function childPartsOf<Id extends string>(
  children: ReadonlyArray<ChildNotch<Id> & { title: string }>,
  visible: ReadonlySet<string>,
  kind: "quest" | "errand",
  openChild: (id: Id) => void,
  openList: () => void,
): Array<NotchPart> {
  const { shown, more } = childNotchesOf(children, visible);
  const parts = shown.map<NotchPart>((child) => ({
    id: `child:${child.id}`,
    kind,
    onReveal: () => openChild(child.id),
    state: child.state,
    title: children.find((entry) => entry.id === child.id)?.title ?? "",
  }));
  if (more !== null)
    parts.push({
      count: more.count,
      id: `more:${kind}s`,
      kind: "more",
      onReveal: openList,
      state: more.state,
      title: `Show ${more.count} more ${kind}s`,
    });
  return parts;
}

type NotchThread = Pick<ThreadSummary, "id" | "isArchived" | "lastActivityAt" | "parentId" | "shownState" | "title">;

/** Places folded and child shortcuts on the edges of open panes. */
export function paneNotchesOf({
  channel,
  fullChain,
  missionId,
  missions,
  onOpenMission,
  openList,
  quest,
  revealPane,
  revealThread,
  slots,
  threads,
}: {
  channel: { id: string | null; name: string };
  fullChain: ReadonlyArray<PaneId>;
  missionId: MissionId;
  missions: ReadonlyArray<MissionSummary>;
  onOpenMission: (id: MissionId) => void;
  openList: (id: PaneId) => void;
  quest: ThreadId | undefined;
  revealPane: (id: PaneId) => void;
  revealThread: (id: ThreadId) => void;
  slots: ReadonlyArray<PaneSlot<PaneId>>;
  threads: ReadonlyArray<NotchThread>;
}) {
  // The dot of a folded pane: a realm shows the mark derived from its quests (it has no status), the quest its own
  // status, and an errand its status rolled up with the errands beneath it.
  const notchStateOf = (id: PaneId, summary: NotchThread | undefined): NotchPart["state"] => {
    if (id === channelId)
      return realmMarkOf(missions.filter((mission) => mission.workspaceId === channel.id).map(({ state }) => state));
    if (id === starterId) return null;
    if (id === quest) return missions.find((mission) => mission.id === missionId)?.state ?? summary?.shownState ?? null;
    return summary?.shownState ?? null;
  };
  const notchOf = (id: PaneId): NotchPart | null => {
    const summary = isThreadPane(id) ? threads.find((thread) => thread.id === id) : undefined;
    // An inactive errand remains readable in its pane or from the Errands tab, but has no edge shortcut.
    if (id !== quest && summary !== undefined && (summary.isArchived || urgencyOf(summary.shownState) === null))
      return null;
    return {
      id,
      isNew: id === starterId,
      kind: id === channelId ? (channel.id === null ? "borderlands" : "realm") : id === quest ? "quest" : "errand",
      onReveal: () => revealPane(id),
      state: notchStateOf(id, summary),
      title: id === channelId ? channel.name : id === starterId ? "New errand" : (summary?.title ?? ""),
    };
  };
  // The active errands of the quest and the active quests of the realm that have no pane or notch yet, as notches on the
  // right edge of the quest's or the realm's own pane.
  const childNotchesOfPane = (id: PaneId): Array<NotchPart> => {
    const isChannel = id === channelId;
    if (!isChannel && id !== quest) return [];
    return isChannel
      ? childPartsOf(
          missions.filter((mission) => mission.workspaceId === channel.id),
          new Set([missionId]),
          "quest",
          onOpenMission,
          () => openList(id),
        )
      : childPartsOf(
          threads
            .filter((thread) => thread.parentId !== null)
            .map((thread) => ({ ...thread, state: thread.shownState })),
          new Set(fullChain),
          "errand",
          revealThread,
          () => openList(id),
        );
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
  return notchesAt;
}
