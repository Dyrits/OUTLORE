import type { PanelContent } from "../foundation/panelState";

/** Whether the right-hand column is open on the quest's own tab: the state the quest icon in a quest's header shows. */
export const isQuestTabOpen = (column: {
  activeTab: "quest" | "companion";
  hasQuestPanel: boolean;
  isColumnOpen: boolean;
}): boolean => column.hasQuestPanel && column.isColumnOpen && column.activeTab === "quest";

/**
 * What a press on the quest icon asks of the column: pressed while the quest tab shows, it closes the column; otherwise
 * it opens it on the quest tab, also when the column showed the Companions tab.
 */
export const panelAfterQuestIcon = (isQuestTabShown: boolean): PanelContent | null =>
  isQuestTabShown ? null : { tab: "quest" };

/** The pane the pointer went down in, and which pane the panel followed just before, with the time it went down. */
export type PanePointer = { at: number; followedBefore: string | null };

/** How long after a pointer goes down in a pane a press on its icon still counts as the same gesture, in milliseconds. */
export const pointerGestureMs = 800;

/**
 * Whether the panel already followed `id` when the press on its icon began. A pane takes focus as the pointer goes down,
 * before the press ends, so by the press the pane always looks followed; the pane the panel followed before the pointer
 * went down says which it was. Without a recent pointer (a keyboard press), the panel's current pane is the answer.
 */
export const wasFollowedAtPress = (input: {
  followedNow: string | null;
  id: string;
  now: number;
  pointer: PanePointer | null;
}): boolean => {
  const { followedNow, id, now, pointer } = input;
  if (pointer === null || now - pointer.at > pointerGestureMs) return followedNow === id;
  return pointer.followedBefore === id;
};

/**
 * What a press on a pane's quest icon does to the panel: it toggles the panel when it is shut or already follows this
 * pane, and only moves to this pane when it was open for another one, rather than closing it there (so a second press
 * is not needed).
 */
export const paneIconPress = (input: { isOpen: boolean; wasFollowed: boolean }): "toggle" | "switch" =>
  input.isOpen && !input.wasFollowed ? "switch" : "toggle";
