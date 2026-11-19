import type { SidebarSide } from "../foundation/sidebarPreferenceRules";

// The rules of the overlay sidebar (CHG-0557): when the pointer asks it to open or close, and how long it waits. The
// frame only listens to the pointer and does what these say, so the rules run in plain Node.

/** How far from the window's edge the pointer opens the sidebar, in pixels. */
export const hotZoneWidth = 6;

/**
 * How long the pointer waits before the overlay opens or closes, in milliseconds. Opening waits longer so that a stray
 * pointer crossing the edge does not trigger it; closing is quicker, with a short grace for a pointer that slips out.
 */
export const overlayDelays = { close: 160, open: 220 } as const;

/** What the pointer asks of the overlay: to open, to close, or to leave it as it is. */
export type OverlayWish = "open" | "close" | "stay";

/** Where the pointer, the window and the panel stand. `x` is the pointer's distance from the window's left; null once it has left the window. */
type Geometry = { panelWidth: number; side: SidebarSide; windowWidth: number; x: number | null };

/** How far a point is from the edge the sidebar belongs to. */
const distanceFromEdge = ({ side, windowWidth, x }: Geometry & { x: number }) =>
  side === "left" ? x : windowWidth - x;

/** Whether a press at `x` falls past the open panel, where it dismisses it. */
export const isOutsideOverlay = (geometry: Geometry & { x: number }): boolean =>
  distanceFromEdge(geometry) > geometry.panelWidth;

/**
 * What the pointer asks of the overlay. Shut, it opens at the edge. Open, it closes when the pointer goes past the
 * panel or out of the window, except while a quest or realm is dragged or the panel's own edge is dragged, which keep
 * it open: the drop target and the resizer are in it. A drag at the edge still opens it, so a quest can be dropped
 * on a realm that is not in view yet.
 */
export const overlayWishOf = (
  input: Geometry & { isDragging: boolean; isOpen: boolean; isResizing: boolean },
): OverlayWish => {
  const { x } = input;
  if (input.isOpen) {
    if (input.isDragging || input.isResizing) return "stay";
    if (x === null) return "close";
    return isOutsideOverlay({ ...input, x }) ? "close" : "stay";
  }
  if (x === null) return "stay";
  return distanceFromEdge({ ...input, x }) < hotZoneWidth ? "open" : "stay";
};
