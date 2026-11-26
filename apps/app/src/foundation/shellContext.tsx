import type { ReactNode } from "react";
import { createContext, useContext, useEffect } from "react";
import type { CompanionPickerProps } from "./companionPickerProps";

export const SidebarShown = createContext(false);

/** Whether the sidebar shows, so a screen can leave out the links it already offers. */
export const useHasSidebar = () => useContext(SidebarShown);

export const TopBarShown = createContext(false);

/** Whether the window has a top bar, so a screen can leave out what the bar's icons already offer. */
export const useHasTopBar = () => useContext(TopBarShown);

/**
 * The quest icon of a quest's header: whether the right-hand column shows the quest's own tab, and how a press shows or
 * hides it. Null where the window has no such column (a narrow one, whose top bar has the panel's icon).
 */
export type QuestTabButton = { isOpen: boolean; onPress: () => void };
export const QuestTabButtonContext = createContext<QuestTabButton | null>(null);

/**
 * What a conversation puts in the narrow window's top bar (CHG-0773): its title and, at the bar's right, the actions the
 * desktop's pane header carries (new quest or errand, mark as done, archive).
 */
export type PhoneHeader = { actions: ReactNode; title: ReactNode };

/**
 * How the narrow window's top bar is handed a conversation's header. Null where a conversation draws its own header (a
 * wide window has none) or where it is not the screen on show, so a parked one never takes the bar.
 */
export const PhoneHeaderSetter = createContext<((header: PhoneHeader | null) => void) | null>(null);

export const QuestPanelSetter = createContext<(panel: ReactNode, title: string) => void>(() => {});

/**
 * Hands the window's frame the quest's side panel, which it shows beside the top bar's icon, spanning the window's
 * height. The panel leaves with the screen that gave it. The frame redraws without the screen, so this cannot loop.
 */
export const useQuestPanel = (panel: ReactNode, title = "Quest") => {
  const set = useContext(QuestPanelSetter);
  useEffect(() => set(panel, title));
  useEffect(() => () => set(null, "Quest"), [set]);
};

/**
 * What a Companion button asks of the window: the Companion tab of the right-hand column (beside the quest's own tab)
 * shows the picker for the button that opened it. A button registers while it is mounted, hands over its latest
 * picker state after every render, and asks to open the tab. Null where the window has no such column (a narrow one).
 */
export type CompanionDock = {
  /** Opens the column on the Companion tab for this button. */
  open: (id: string) => void;
  /** The button's latest picker state; the tab draws it. Lower ranks are chosen first when no button asked. */
  publish: (id: string, picker: CompanionPickerProps, rank: number) => void;
  register: (id: string) => void;
  unregister: (id: string) => void;
};
export const CompanionDockActions = createContext<CompanionDock | null>(null);

/** The button whose picker the open Companion tab shows, or null while the tab is not showing. */
export const CompanionTabOf = createContext<string | null>(null);
