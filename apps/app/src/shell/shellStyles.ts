import { StyleSheet } from "react-native";
import { colors, radii } from "../foundation/theme";

/** The size of the round handle on the rail's edge that collapses and expands it. */
export const handleSize = 26;

/** The frame's styles: the window below the top bar, the handles on the columns' edges, and the content's panel. */
export const shellStyles = StyleSheet.create({
  // The window below the top bar: the frame, then the quest panel and Chronicler's column, which the quest panel's handle
  // straddles; the handle is centered on this body.
  body: { flex: 1, flexDirection: "row" },
  // Closed, the handle is the half of a circle against the window's right edge.
  endHandleTab: {
    borderBottomRightRadius: 0,
    borderRightWidth: 0,
    borderTopRightRadius: 0,
    height: handleSize * 1.5,
    marginTop: -handleSize * 0.75,
    paddingLeft: 3,
    right: 0,
    width: handleSize * 0.75,
  },
  // Chronicler restored to the whole content area: over the screen, which stays mounted beneath, and the sidebar stays.
  fill: { backgroundColor: colors.page, bottom: 0, left: 0, position: "absolute", right: 0, top: 0, zIndex: 7 },
  frame: { backgroundColor: colors.ground, flex: 1, flexDirection: "row", overflow: "hidden" },
  handle: {
    alignItems: "center",
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    borderRadius: radii.pill,
    borderWidth: 1,
    height: handleSize,
    justifyContent: "center",
    marginTop: -handleSize / 2,
    position: "absolute",
    top: "50%",
    width: handleSize,
    // Above the strip that resizes the sidebar, which runs beneath the button.
    zIndex: 4,
  },
  handlePressed: { backgroundColor: colors.ground },
  // Hidden, the handle is the half of a circle against the window's left edge.
  handleTab: {
    borderBottomLeftRadius: 0,
    borderLeftWidth: 0,
    borderTopLeftRadius: 0,
    height: handleSize * 1.5,
    left: 0,
    marginTop: -handleSize * 0.75,
    paddingRight: 3,
    width: handleSize * 0.75,
  },
  // The Islands layout's frame: the canvas shows through, and the islands' shadows are not cut at its edge.
  islandFrame: { backgroundColor: "transparent", overflow: "visible" },
  islandWindow: { backgroundColor: "transparent" },
  panel: { backgroundColor: colors.page, flex: 1, overflow: "hidden" },
  panelDivider: { borderColor: colors.edge, borderLeftWidth: 1 },
  // The content when it holds the panes: they are the islands, so the panel is nothing and the shadows are not cut.
  panelOfIslands: { backgroundColor: "transparent", overflow: "visible" },
  window: { backgroundColor: colors.ground, flex: 1 },
});
