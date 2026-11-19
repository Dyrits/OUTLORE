/** How the sidebar sits in the window: floating over the panes until the pointer asks for it, or kept in the frame. */
export const sidebarModes = ["overlay", "docked"] as const;
export type SidebarMode = (typeof sidebarModes)[number];

/** The edge of the window the overlay sidebar belongs to. */
export const sidebarSides = ["left", "right"] as const;
export type SidebarSide = (typeof sidebarSides)[number];

/** The mode a stored value names; anything unknown, or nothing stored, is the overlay (CHG-0557). */
export const sidebarModeOf = (stored: string | null): SidebarMode =>
  sidebarModes.find((mode) => mode === stored) ?? "overlay";

/** The side a stored value names; anything unknown, or nothing stored, is the left edge. */
export const sidebarSideOf = (stored: string | null): SidebarSide =>
  sidebarSides.find((side) => side === stored) ?? "left";
