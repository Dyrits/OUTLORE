import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../foundation/theme";

// Where Chronicler's conversation lives (quest coordination, Chronicler everywhere): the top bar's button opens it, as a
// column beside any screen on a wide window or as the whole content area on a narrow one, and the owner folds it back.

/** How wide the column beside a screen is as it opens, and the least the owner can drag it to. */
export const chroniclerColumnWidth = 380;

/**
 * Chronicler as a column at the window's far right, beyond the quest panel and below the top bar, which spans the window:
 * `edge` is the strip on its left edge that the owner drags to widen it.
 */
export function ChroniclerColumn({ children, edge, width }: { children: ReactNode; edge: ReactNode; width: number }) {
  return (
    <View accessibilityLabel="Chronicler" style={[local.column, { width }]}>
      {edge}
      {children}
    </View>
  );
}

const local = StyleSheet.create({
  column: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderLeftWidth: 1,
  },
});
