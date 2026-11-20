import { useCallback, useEffect, useRef, useState } from "react";
import type { SidebarSide } from "../foundation/sidebarPreferenceRules";
import { dragCarriesQuest, dragCarriesRealm } from "./questDragTypes";
import { isOutsideOverlay, overlayDelays, overlayWishOf } from "./sidebarMode";

/** What the frame needs of the overlay sidebar: whether it shows, how to put it away, and the resize flag. */
export type SidebarOverlay = {
  close: () => void;
  isOpen: boolean;
  /** Set while the panel's own edge is dragged, so the pointer running ahead of the panel does not close it. */
  setIsResizing: (isResizing: boolean) => void;
};

/**
 * The overlay sidebar's behavior on the web build: opens after a short delay when the pointer reaches the edge, closes
 * when it leaves the panel, on a press outside, and on Escape, and stays open while a quest is dragged. Where there
 * is no document it only opens and closes by hand. `isEnabled` is false in the docked mode, which keeps the frame's own
 * sidebar and leaves the pointer alone.
 */
export function useSidebarOverlay(input: {
  isEnabled: boolean;
  panelWidth: number;
  side: SidebarSide;
  windowWidth: number;
}): SidebarOverlay {
  const [isOpen, setIsOpen] = useState(false);
  const state = useRef({ hasEntered: false, isDragging: false, isOpen: false, isResizing: false });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(input);
  latest.current = input;

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const set = useCallback(
    (next: boolean, isByPointer = false) => {
      clear();
      state.current.isOpen = next;
      // Opened at the edge, the pointer is at the panel already; opened by hand, it has yet to come.
      state.current.hasEntered = isByPointer;
      setIsOpen(next);
    },
    [clear],
  );
  const schedule = useCallback(
    (next: boolean, delay: number) => {
      if (timer.current !== null) return;
      timer.current = setTimeout(() => set(next, true), delay);
    },
    [set],
  );
  const close = useCallback(() => set(false), [set]);
  const setIsResizing = useCallback((isResizing: boolean) => {
    state.current.isResizing = isResizing;
  }, []);

  const { isEnabled } = input;
  useEffect(() => {
    if (!isEnabled) set(false);
    if (!isEnabled || typeof document === "undefined") return;
    /** Applies what the pointer asks, after its delay; a pointer that goes back before the delay cancels it. */
    const follow = (x: number | null) => {
      const geometry = { ...latest.current, x };
      const wish = overlayWishOf({ ...geometry, ...state.current });
      if (state.current.isOpen && x !== null && !isOutsideOverlay({ ...geometry, x })) state.current.hasEntered = true;
      if (wish === "stay") return clear();
      // A panel opened by hand waits for the pointer to visit it before it can close by leaving.
      if (wish === "close" && !state.current.hasEntered && !state.current.isDragging) return;
      schedule(wish === "open", wish === "open" ? overlayDelays.open : overlayDelays.close);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") follow(event.clientX);
    };
    const onLeave = () => follow(null);
    const onDown = (event: PointerEvent) => {
      const geometry = { ...latest.current, x: event.clientX };
      if (state.current.isOpen && isOutsideOverlay(geometry)) set(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && state.current.isOpen) set(false);
    };
    const onDragStart = (event: DragEvent) => {
      const types = Array.from(event.dataTransfer?.types ?? []);
      state.current.isDragging = dragCarriesQuest(types) || dragCarriesRealm(types);
    };
    // A drag fires no pointer moves, so its position comes from the drag's own events.
    const onDragOver = (event: DragEvent) => {
      if (!state.current.isDragging) onDragStart(event);
      if (state.current.isDragging) follow(event.clientX);
    };
    const onDragEnd = () => {
      state.current.isDragging = false;
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    document.addEventListener("dragstart", onDragStart);
    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragend", onDragEnd);
    document.addEventListener("drop", onDragEnd);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      clear();
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("dragstart", onDragStart);
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragend", onDragEnd);
      document.removeEventListener("drop", onDragEnd);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [clear, isEnabled, schedule, set]);

  return { close, isOpen, setIsResizing };
}
