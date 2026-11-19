import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { SidebarSide } from "../foundation/sidebarPreferenceRules";
import { colors } from "../foundation/theme";

// The panel is moved off the window with a transform, not unmounted: the sidebar keeps its folds and its open dialogs
// (a new realm, a confirmation of a move) when the pointer leaves, and a dialog is not closed under the owner's hand.
const slide = { transitionDuration: "140ms", transitionProperty: "transform" } as object;

/**
 * The sidebar as an overlay (CHG-0557): it floats over the panes along the window's edge without moving them, over
 * the quest panel and Chronicler's column too. `children` is the sidebar itself, sized to `width`; the frame decides,
 * with `useSidebarOverlay`, when it is `isOpen`.
 */
export function SidebarOverlay({
  children,
  isOpen,
  side,
  width,
}: {
  children: ReactNode;
  isOpen: boolean;
  side: SidebarSide;
  width: number;
}) {
  const hiddenOffset = side === "left" ? -width - 16 : width + 16;
  return (
    <View
      accessibilityElementsHidden={!isOpen}
      style={[
        local.panel,
        side === "left" ? local.left : local.right,
        isOpen && local.raised,
        { transform: [{ translateX: isOpen ? 0 : hiddenOffset }], width },
        slide,
        { pointerEvents: isOpen ? "auto" : "none" },
      ]}
    >
      {children}
    </View>
  );
}

const local = StyleSheet.create({
  left: { borderRightWidth: 1, left: 0 },
  panel: {
    backgroundColor: colors.sidebar,
    borderColor: colors.edge,
    bottom: 0,
    // A row, so the sidebar stretches to the window's height as it does in the frame.
    flexDirection: "row",
    position: "absolute",
    top: 0,
    // Above the panes and the columns, and above the handles that straddle their edges.
    zIndex: 20,
  },
  raised: { boxShadow: "0 0 24px rgba(0, 0, 0, 0.28)" },
  right: { borderLeftWidth: 1, right: 0 },
});
