import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";

/** The look of the Workshop's Companions tab: its tabs, preset rows, and notes. */
export const companionStyles = StyleSheet.create({
  backups: { gap: 8, paddingTop: 8 },
  custom: { gap: 4 },
  customName: { color: colors.textSecondary, flexShrink: 0, fontSize: 13, fontWeight: "500", maxWidth: "50%" },
  customRow: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  customSummary: {
    color: colors.textMuted,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.sm,
    textAlign: "right",
  },
  details: { flex: 1, gap: 14, minWidth: 0 },
  draftActions: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  nav: { gap: 4, width: 176 },
  navStacked: { gap: 4 },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  // The column's tabs sit 20 px above the first row (its own 12 px of padding, shortened to 6 for this panel) and the rows 8 px apart; every gap is 14 px.
  panel: { gap: 14 },
  split: { flexDirection: "row" },
  tab: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 5,
  },
  tabActive: { backgroundColor: colors.controlActive },
  tabs: { flexDirection: "row", gap: 6 },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: colors.accentText, fontWeight: "700" },
  tier: { gap: 8 },
  title: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.xs, fontWeight: "600" },
});
