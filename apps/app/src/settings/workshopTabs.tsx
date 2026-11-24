import type { Tier, TierName } from "@outlore/contracts";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useRef, useState } from "react";

/** A built-in tier or a custom preset keyed by name. */
export type WorkshopPreset = TierName | `custom:${string}`;

/** The default Companion or the preset selected in the Workshop. */
export type WorkshopFocus = "Default" | WorkshopPreset;

interface WorkshopTabs {
  /** Closes the Companions tab, from whichever of the page's tables it was opened by. */
  closeTab: () => void;
  /** Throws the draft away. */
  discardDraft: () => void;
  /** The preset being made, not yet saved under a name; it shows in the tab in place of any preset. */
  draft: Tier | null;
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
  setDraft: (draft: Tier) => void;
  setFocus: (focus: WorkshopFocus) => void;
  /** Starts a draft from `stack` and asks the table of `at` to open the tab. */
  startDraft: (stack: Tier, at: WorkshopFocus) => void;
  unregister: (focus: WorkshopFocus) => void;
}

const WorkshopTabsContext = createContext<WorkshopTabs>({
  closeTab: () => {},
  discardDraft: () => {},
  draft: null,
  focus: "Default",
  isOpen: false,
  lastPreset: "Light",
  report: () => {},
  revealed: () => {},
  revealing: null,
  setDraft: () => {},
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
  const [draft, setDraft] = useState<Tier | null>(null);
  const [revealing, setRevealing] = useState<WorkshopFocus | null>(null);
  const presses = useRef(new Map<WorkshopFocus, { isOpen: boolean; press: () => void }>());
  const setFocus = useCallback((next: WorkshopFocus) => {
    setFocusState(next);
    // Choosing any Companion leaves a draft behind.
    setDraft(null);
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
    setDraft(null);
    [...presses.current.values()].find((entry) => entry.isOpen)?.press();
  }, []);
  const revealed = useCallback((at: WorkshopFocus) => setRevealing((now) => (now === at ? null : now)), []);
  const discardDraft = useCallback(() => setDraft(null), []);
  const startDraft = useCallback((stack: Tier, at: WorkshopFocus) => {
    setDraft(stack);
    setRevealing(at);
  }, []);
  const value = useMemo(
    () => ({
      closeTab,
      discardDraft,
      draft,
      focus,
      isOpen,
      lastPreset,
      report,
      revealed,
      revealing,
      setDraft,
      setFocus,
      startDraft,
      unregister,
    }),
    [
      closeTab,
      discardDraft,
      draft,
      focus,
      isOpen,
      lastPreset,
      report,
      revealed,
      revealing,
      setFocus,
      startDraft,
      unregister,
    ],
  );
  return <WorkshopTabsContext.Provider value={value}>{children}</WorkshopTabsContext.Provider>;
}
