import { useEffect, useRef } from "react";

/**
 * The desktop app's File > Workshop… (⌘,) opens the Workshop; chosen while it is already open, it leaves it there
 * instead of going back like the sidebar's row does.
 */
export function useWorkshopMenu(isWorkshopOpen: boolean, onWorkshop: () => void) {
  const latest = useRef({ isWorkshopOpen, onWorkshop });
  latest.current = { isWorkshopOpen, onWorkshop };
  useEffect(() => {
    const bridge = typeof window === "undefined" ? undefined : window.outlore?.workshopMenu;
    if (bridge === undefined) return;
    return bridge.listen(() => {
      if (!latest.current.isWorkshopOpen) latest.current.onWorkshop();
    });
  }, []);
}
