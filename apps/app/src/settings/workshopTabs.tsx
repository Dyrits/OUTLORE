import type { Tier, TierName } from "@outlore/contracts";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { workshopDraft } from "./workshopDraft";

/** A built-in tier or a custom preset keyed by name. */
export type WorkshopPreset = TierName | `custom:${string}`;

/** The default Companion or the preset selected in the Workshop. */
export type WorkshopFocus = "Default" | WorkshopPreset;

interface WorkshopTabs {
  /** Closes the Companions tab, from whichever of the page's tables it was opened by. */
  closeTab: () => void;
  focus: WorkshopFocus;
  /** Whether the Companions tab shows one of the page's Companions. */
  isOpen: boolean;
  /** The preset last shown, which the Presets tab returns to. */
  lastPreset: WorkshopPreset;
  /** Each table's chevron tells whether the tab shows it, and how it is pressed. */
  report: (focus: WorkshopFocus, isOpen: boolean, press: () => void) => void;
  /** Clears the request to show a preset once its table has shown it. */
  revealed: (focus: WorkshopFocus) => void;
  /** The preset a table is asked to show in the tab, such as one just added. */
  revealing: WorkshopFocus | null;
  setFocus: (focus: WorkshopFocus) => void;
  /** Starts a draft from `stack` and asks the table of `at` to open the tab. */
  startDraft: (stack: Tier, at: WorkshopFocus) => void;
  unregister: (focus: WorkshopFocus) => void;
}

const WorkshopTabsContext = createContext<WorkshopTabs>({
  closeTab: () => {},
  focus: "Default",
  isOpen: false,
  lastPreset: "Light",
  report: () => {},
  revealed: () => {},
  revealing: null,
  setFocus: () => {},
  startDraft: () => {},
  unregister: () => {},
});

export const useWorkshopTabs = () => useContext(WorkshopTabsContext);

/** Shares the selected Companion between the Workshop tables and the Companions panel. */
export function WorkshopTabsProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState<WorkshopFocus>("Default");
  const [lastPreset, setLastPreset] = useState<WorkshopPreset>("Light");
  const [isOpen, setIsOpen] = useState(false);
  const [revealing, setRevealing] = useState<WorkshopFocus | null>(null);
  const presses = useRef(new Map<WorkshopFocus, { isOpen: boolean; press: () => void }>());
  const setFocus = useCallback((next: WorkshopFocus) => {
    setFocusState(next);
    // Choosing any Companion leaves a draft behind.
    workshopDraft.set(null);
    if (next !== "Default") setLastPreset(next);
  }, []);
  const report = useCallback((at: WorkshopFocus, isShown: boolean, press: () => void) => {
    presses.current.set(at, { isOpen: isShown, press });
    const isAnyShown = [...presses.current.values()].some((entry) => entry.isOpen);
    setIsOpen((before) => (before === isAnyShown ? before : isAnyShown));
  }, []);
  const unregister = useCallback((at: WorkshopFocus) => {
    presses.current.delete(at);
    setIsOpen([...presses.current.values()].some((entry) => entry.isOpen));
  }, []);
  const closeTab = useCallback(() => {
    // A draft is the tab's own: closing the tab throws it away.
    workshopDraft.set(null);
    [...presses.current.values()].find((entry) => entry.isOpen)?.press();
  }, []);
  const revealed = useCallback((at: WorkshopFocus) => setRevealing((now) => (now === at ? null : now)), []);
  const startDraft = useCallback((stack: Tier, at: WorkshopFocus) => {
    workshopDraft.set(stack);
    setRevealing(at);
  }, []);
  // Leaving the Workshop drops a draft that was never saved.
  useEffect(() => () => workshopDraft.set(null), []);
  const value = useMemo(
    () => ({
      closeTab,
      focus,
      isOpen,
      lastPreset,
      report,
      revealed,
      revealing,
      setFocus,
      startDraft,
      unregister,
    }),
    [closeTab, focus, isOpen, lastPreset, report, revealed, revealing, setFocus, startDraft, unregister],
  );
  return <WorkshopTabsContext.Provider value={value}>{children}</WorkshopTabsContext.Provider>;
}
