import { type Dispatch, useEffect, useRef } from "react";
import type { PanelContent } from "../foundation/panelState";
import type { RightPanel } from "../foundation/useRightPanel";
import type { NavigationEvent } from "./location";

/**
 * The Workshop's icon (CHG-0563). It opens the Workshop over the whole content area and, pressed again, goes back to where
 * the owner was. The location already comes back as it was, and the panes wait mounted beneath the Workshop; the details
 * panel belongs to a destination and starts closed in the next one, so what it held is kept here and put back on the way
 * home.
 */
export function useWorkshopTrip(input: {
  dispatch: Dispatch<NavigationEvent>;
  isWorkshopOpen: boolean;
  panel: RightPanel;
}) {
  const { dispatch, isWorkshopOpen, panel } = input;
  const kept = useRef<PanelContent | null>(null);
  const toRestore = useRef<PanelContent | null>(null);
  // After the location has changed, the panel is the destination's own again: this render's `show` belongs to it.
  useEffect(() => {
    if (toRestore.current === null) return;
    panel.show(toRestore.current);
    toRestore.current = null;
  });
  return () => {
    if (isWorkshopOpen) {
      toRestore.current = kept.current;
      kept.current = null;
    } else kept.current = panel.content;
    dispatch({ type: "workshop" });
  };
}
