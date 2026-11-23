import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useIslandFrame } from "../foundation/islands";
import type { SidebarSide } from "../foundation/sidebarPreferenceRules";
import { colors } from "../foundation/theme";

// The panel is moved off the window with a transform, not unmounted: the sidebar keeps its folds and its open dialogs
// (a new realm, a confirmation of a move) when the pointer leaves, and a dialog is not closed under the owner's hand.
const slide = { transitionDuration: "140ms", transitionProperty: "transform" } as object;

/**
 * The sidebar as an overlay (CHG-0560): it floats over the panes along the window's edge without moving them, over
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
  // In the Islands theme the sidebar is an island of its own, standing off the window's edges by the gap.
  const islands = useIslandFrame();
  const gap = islands?.gap ?? 0;
  const hiddenOffset = side === "left" ? -width - gap - 16 : width + gap + 16;
  return (
    <View
      accessibilityElementsHidden={!isOpen}
      style={[
        local.panel,
        side === "left" ? local.left : local.right,
        isOpen && islands === null && local.raised,
        islands !== null && [local.island, { bottom: gap, [side]: gap }],
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
  island: { backgroundColor: "transparent", borderLeftWidth: 0, borderRightWidth: 0 },
  left: { borderRightWidth: 1, left: 0 },
  panel: {
    backgroundColor: colors.page,
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
