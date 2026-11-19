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
