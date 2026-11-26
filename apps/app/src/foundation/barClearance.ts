import { createContext, useContext } from "react";

/**
 * The room the narrow window's floating bar takes at the foot of the screen (CHG-0773): a screen that scrolls beneath
 * the bar keeps this much room after its last row, so the row stays reachable. Zero where the bar does not cover the
 * screen, as in a wide window.
 */
export const BarClearanceContext = createContext(0);

/** The style a scrolling screen adds to its content container to keep clear of the bar; null where there is no bar. */
export function useBarClearance(): { paddingBottom: number } | null {
  const clearance = useContext(BarClearanceContext);
  return clearance === 0 ? null : { paddingBottom: clearance };
}
