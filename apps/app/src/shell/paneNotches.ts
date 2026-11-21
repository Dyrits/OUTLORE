import type { MissionId, MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { realmMarkOf } from "../foundation/realmMark";
import { type ChildNotch, childNotchesOf, urgencyOf } from "./childNotches";
import type { PaneSlot } from "./paneChain";
import type { PaneContent, PaneId } from "./paneIds";
import type { NotchPart } from "./paneStrip";

/** Width reserved for a full notch. */
export const notchWidth = 26;

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
  revealPane: (id: PaneId) => void;
  revealThread: (id: ThreadId) => void;
  slots: ReadonlyArray<PaneSlot<PaneId> & { content: PaneContent }>;
  threads: ReadonlyArray<NotchThread>;
}) {
  // The dot of a folded pane: a realm shows the mark derived from its quests (it has no status), the quest its own
  // status, and an errand its status rolled up with the errands beneath it.
  const notchStateOf = (content: PaneContent, summary: NotchThread | undefined): NotchPart["state"] => {
    if (content.kind === "channel")
      return realmMarkOf(missions.filter((mission) => mission.workspaceId === channel.id).map(({ state }) => state));
    if (content.kind === "starter") return null;
    if (content.kind === "quest")
      return missions.find((mission) => mission.id === missionId)?.state ?? summary?.shownState ?? null;
    return summary?.shownState ?? null;
  };
  const notchOf = (content: PaneContent): NotchPart | null => {
    const { id, kind } = content;
    const summary = kind === "quest" || kind === "errand" ? threads.find((thread) => thread.id === id) : undefined;
    // An inactive errand remains readable in its pane or from the Errands tab, but has no edge shortcut.
    if (kind === "errand" && summary !== undefined && (summary.isArchived || urgencyOf(summary.shownState) === null))
      return null;
    return {
      id,
      isNew: kind === "starter",
      kind: kind === "channel" ? (channel.id === null ? "borderlands" : "realm") : kind === "starter" ? "errand" : kind,
      onReveal: () => revealPane(id),
      state: notchStateOf(content, summary),
      title: kind === "channel" ? channel.name : kind === "starter" ? "New errand" : (summary?.title ?? ""),
    };
  };
  // The active errands of the quest and the active quests of the realm that have no pane or notch yet, as notches on the
  // right edge of the quest's or the realm's own pane.
  const childNotchesOfPane = ({ id, kind }: PaneContent): Array<NotchPart> => {
    const isChannel = kind === "channel";
    if (!isChannel && kind !== "quest") return [];
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
      const content = slots[each]?.content;
      const notch = content === undefined ? null : notchOf(content);
      if (notch !== null) left.unshift(notch);
    }
    const right: Array<NotchPart> = [];
    const own = slots[depth]?.content;
    // Only the last open pane has a right edge: it lists its folded panes, then its own children (a realm's quests, a
    // quest's errands). A pane with another open pane after it shows none, since that pane already stands for them.
    if (slots.slice(depth + 1).every((slot) => slot.kind === "strip")) {
      for (let each = depth + 1; slots[each]?.kind === "strip"; each += 1) {
        const content = slots[each]?.content;
        const notch = content === undefined ? null : notchOf(content);
        if (notch !== null) right.push(notch);
      }
      // The realm's edge lists quests only: the errands folded after its quest are not its own, so they show no notch there.
      const shownRight = own?.kind === "channel" ? right.filter((part) => part.kind === "quest") : right;
      return { left, right: [...shownRight, ...(own === undefined ? [] : childNotchesOfPane(own))] };
    }
    return { left, right };
  };
  const parts = slots.map((slot) => (slot.kind === "pane" ? notchesAt(slot.depth) : { left: [], right: [] }));
  const firstOpen = slots.findIndex((slot) => slot.kind === "pane");
  return (depth: number) => {
    const { left, right } = parts[depth] ?? { left: [], right: [] };
    const isStraddling = left.length > 0 && depth > firstOpen;
    const next = slots.find((slot) => slot.depth > depth && slot.kind === "pane");
    const nextStraddles =
      slots[depth]?.kind === "pane" && next !== undefined && (parts[next.depth]?.left.length ?? 0) > 0;
    return {
      isStraddling,
      left,
      paddingLeft: left.length === 0 ? 0 : isStraddling ? notchWidth / 2 : notchWidth,
      paddingRight: right.length > 0 ? notchWidth : nextStraddles ? notchWidth / 2 : 0,
      right,
    };
  };
}
