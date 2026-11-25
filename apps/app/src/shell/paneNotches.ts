import type { MissionId, MissionSummary, ThreadId, ThreadSummary } from "@outlore/contracts";
import { realmMarkOf } from "../foundation/realmMark";
import { childStatusOf } from "./childNotches";
import type { PaneSlot } from "./paneChain";
import type { PaneContent, PaneId } from "./paneIds";
import type { NotchPart } from "./paneStrip";
import { inRealmOf } from "./realmRoster";

/** Width reserved for a full notch. */
export const notchWidth = 26;

/**
 * How far a notch that straddles the line between two open panes reaches into each of them. The Islands layout has a
 * `gap` between the panes where the line was, which holds part of the notch.
 */
export const straddleReachOf = (gap: number): number => Math.max(0, (notchWidth - gap) / 2);

/** The create and browse controls for the children of an open pane. */
export function childPartsOf(
  kind: "quest" | "errand",
  state: NotchPart["state"],
  start: (() => void) | null,
  openList: () => void,
): ReadonlyArray<NotchPart> {
  const list: NotchPart = {
    id: `list:${kind}s`,
    kind: "list",
    listOf: kind,
    onReveal: openList,
    state,
    title: kind === "quest" ? "Quests" : "Errands",
  };
  return start === null
    ? [list]
    : [{ id: `new:${kind}`, isNew: true, kind, onReveal: start, state: null, title: `New ${kind}` }, list];
}

type NotchThread = Pick<ThreadSummary, "id" | "isArchived" | "parentId" | "shownState" | "title">;

/** Places folded and child shortcuts on the edges of open panes. */
export function paneNotchesOf({
  channel,
  gap = 0,
  missionId,
  missions,
  openList,
  revealPane,
  slots,
  startErrand,
  startQuest,
  threads,
}: {
  channel: { id: string | null; name: string };
  /** The space between open panes in the Islands layout; none in the flat one. */
  gap?: number;
  /** The open quest, or null when only the channel is open. */
  missionId: MissionId | null;
  missions: ReadonlyArray<MissionSummary>;
  openList: (id: PaneId) => void;
  revealPane: (id: PaneId) => void;
  slots: ReadonlyArray<PaneSlot<PaneId> & { content: PaneContent }>;
  startErrand: ((id: ThreadId) => void) | null;
  startQuest: () => void;
  threads: ReadonlyArray<NotchThread>;
}) {
  const mission = missions.find((entry) => entry.id === missionId);
  const kindOf = {
    channel: channel.id === null ? "borderlands" : "realm",
    errand: "errand",
    quest: mission?.ritual == null ? "quest" : "ritual",
    starter: "errand",
  } satisfies Record<PaneContent["kind"], NotchPart["kind"]>;
  // The dot of a folded pane: a realm shows the mark derived from its quests (it has no status), the quest its own
  // status, and an errand its status rolled up with the errands beneath it.
  const notchStateOf = (content: PaneContent, summary: NotchThread | undefined): NotchPart["state"] => {
    if (content.kind === "channel")
      return realmMarkOf(inRealmOf(missions, channel.id, "Quest").map(({ state }) => state));
    if (content.kind === "starter") return null;
    if (content.kind === "quest") return mission?.state ?? summary?.shownState ?? null;
    return summary?.shownState ?? null;
  };
  const notchOf = (content: PaneContent): NotchPart => {
    const { id, kind } = content;
    const summary = kind === "quest" || kind === "errand" ? threads.find((thread) => thread.id === id) : undefined;
    return {
      id,
      isNew: kind === "starter",
      kind: kindOf[kind],
      onReveal: () => revealPane(id),
      state: notchStateOf(content, summary),
      title:
        kind === "channel"
          ? channel.name
          : kind === "starter"
            ? "New errand"
            : (summary?.title ?? (kind === "quest" ? mission?.title : void 0) ?? ""),
    };
  };
  const childNotchesOfPane = (content: PaneContent): ReadonlyArray<NotchPart> => {
    if (content.kind === "channel")
      return childPartsOf("quest", childStatusOf(inRealmOf(missions, channel.id, "Quest")), startQuest, () =>
        openList(content.id),
      );
    if (content.kind === "quest")
      return childPartsOf(
        "errand",
        childStatusOf(
          threads
            .filter((thread) => thread.parentId !== null)
            .map(({ isArchived, shownState }) => ({ isArchived, state: shownState })),
        ),
        startErrand === null ? null : () => startErrand(content.id),
        () => openList(content.id),
      );
    return [];
  };
  // Folded parents sit to the left of the next open pane; child controls sit on the right of the last open pane.
  const notchesAt = (depth: number) => {
    const left: Array<NotchPart> = [];
    for (let each = depth - 1; slots[each]?.kind === "strip"; each -= 1) {
      const content = slots[each]?.content;
      if (content !== undefined) left.unshift(notchOf(content));
    }
    const own = slots[depth]?.content;
    const right =
      own !== undefined && slots.slice(depth + 1).every((slot) => slot.kind === "strip") ? childNotchesOfPane(own) : [];
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
      paddingLeft: left.length === 0 ? 0 : isStraddling ? straddleReachOf(gap) : notchWidth,
      paddingRight: right.length > 0 ? notchWidth : nextStraddles ? straddleReachOf(gap) : 0,
      right,
    };
  };
}
