import { Platform } from "react-native";

/** Whether the pointer is over a pressable: react-native-web reports it in the press state; native has no pointer. */
export const isHovered = (state: unknown) =>
  typeof state === "object" && state !== null && "hovered" in state && state.hovered === true;

/** The style that shows a hand over a clickable element on the web. */
export const handCursor: object = Platform.OS === "web" ? { cursor: "pointer", userSelect: "none" } : {};

/** The style that shows a horizontal resize handle on the web. */
export const colResizeCursor: object = Platform.OS === "web" ? { cursor: "col-resize", userSelect: "none" } : {};

/** The style that shows a vertical resize handle on the web. */
export const rowResizeCursor: object = Platform.OS === "web" ? { cursor: "row-resize", userSelect: "none" } : {};

/** The props that give a web element a tooltip with `title`; none elsewhere. */
export const tooltipOf = (title: string): object => (Platform.OS === "web" ? { title } : {});

/** The style that removes the browser's own focus outline from a field that draws its own border. */
export const noFocusRing: object = Platform.OS === "web" ? { outlineStyle: "none" } : {};
