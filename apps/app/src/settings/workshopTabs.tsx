import type { TierName } from "@outlore/contracts";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

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
  setFocus: (focus: WorkshopFocus) => void;
  unregister: (focus: WorkshopFocus) => void;
}

const WorkshopTabsContext = createContext<WorkshopTabs>({
  closeTab: () => {},
  focus: "Default",
  isOpen: false,
  lastPreset: "Light",
  report: () => {},
  setFocus: () => {},
  unregister: () => {},
});

export const useWorkshopTabs = () => useContext(WorkshopTabsContext);

/** Shares the selected Companion between the Workshop tables and the Companions panel. */
export function WorkshopTabsProvider({ children }: { children: ReactNode }) {
  const [focus, setFocusState] = useState<WorkshopFocus>("Default");
  const [lastPreset, setLastPreset] = useState<WorkshopPreset>("Light");
  const [isOpen, setIsOpen] = useState(false);
  const presses = useRef(new Map<WorkshopFocus, { isOpen: boolean; press: () => void }>());
  const setFocus = useCallback((next: WorkshopFocus) => {
    setFocusState(next);
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
    [...presses.current.values()].find((entry) => entry.isOpen)?.press();
  }, []);
  const value = useMemo(
    () => ({ closeTab, focus, isOpen, lastPreset, report, setFocus, unregister }),
    [closeTab, focus, isOpen, lastPreset, report, setFocus, unregister],
  );
  return <WorkshopTabsContext.Provider value={value}>{children}</WorkshopTabsContext.Provider>;
}
