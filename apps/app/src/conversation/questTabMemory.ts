import type { MutableRefObject } from "react";

/** The tabs of a thread's pane. */
export type PaneTabName = "Missives" | "Errands" | "Quest" | "Ritual" | "Errand" | "Companions";

/**
 * The tab a quest's pane last showed, kept by the screen: panes remount for each quest, so the quest opened next starts
 * on the tab the owner was on, and errands can be browsed quest after quest without choosing the tab again.
 */
export type QuestTabMemory = MutableRefObject<PaneTabName | null>;

/** The tab a quest's pane opens on: Errands when a list was asked for, else the one remembered, else Missives. */
export const initialQuestTabOf = ({
  hasListRequest,
  remembered,
}: {
  hasListRequest: boolean;
  remembered: PaneTabName | null;
}): PaneTabName => (hasListRequest ? "Errands" : (remembered ?? "Missives"));
