import { Platform } from "react-native";

// A row that moves under a pointer that is not moving (the one above it was archived) gets no pointer-enter event, so its
// hover marks stay hidden until the pointer stirs. The web build therefore remembers where the pointer last was.
let point: { x: number; y: number } | null = null;
if (Platform.OS === "web" && typeof document !== "undefined") {
  document.addEventListener(
    "pointermove",
    (event) => {
      point = { x: event.clientX, y: event.clientY };
    },
    { capture: true, passive: true },
  );
  document.addEventListener("pointerleave", () => {
    point = null;
  });
}

/** Whether the pointer's last known place is over the given element (a web element), the one on top there. */
export const isPointerOver = (element: unknown): boolean => {
  if (point === null || typeof document === "undefined" || !(element instanceof Element)) return false;
  const top = document.elementFromPoint(point.x, point.y);
  return top !== null && element.contains(top);
};
