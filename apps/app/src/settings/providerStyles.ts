import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts, outline, radii, round } from "../foundation/theme";

/** The look of the Providers section: cards, account rows, and status pills. */
export const providerStyles = StyleSheet.create({
  account: { alignItems: "center", flexDirection: "row", gap: 14, minHeight: 36 },
  accountBlock: { gap: 4 },
  accountDetail: { flex: 1, minWidth: 0 },
  // Every row's name takes the same width, so the details line up down a card; a long name is cut.
  accountName: { flexBasis: 140, flexShrink: 1, minWidth: 0 },
  accountNameText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  accounts: { borderColor: colors.edge, borderTopWidth: 1, gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  addInput: { minWidth: 180 },
  addRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 },
  card: { ...outline, ...round, backgroundColor: colors.canvas, overflow: "hidden" },
  head: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14, padding: 14 },
  intro: { alignItems: "flex-start", flexDirection: "row", gap: 16 },
  keyForm: { gap: 8, paddingTop: 4 },
  more: { alignItems: "flex-start" },
  name: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  pill: {
    alignItems: "center",
    backgroundColor: colors.controlActive,
    borderRadius: radii.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillDot: { backgroundColor: colors.textMuted, borderRadius: radii.pill, height: 6, width: 6 },
  pillDotGood: { backgroundColor: colors.successText },
  pillGood: { backgroundColor: colors.successSoft },
  pillText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
  pillTextGood: { color: colors.successText },
  problem: { paddingBottom: 14, paddingHorizontal: 16 },
  renameInput: { fontWeight: "700" },
  // The state takes the room between the name and the button, so Update stays at the card's right end.
  state: { alignItems: "center", flexDirection: "row", flexGrow: 1, flexShrink: 1, gap: 12 },
  version: {
    backgroundColor: colors.controlActive,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  versionText: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontWeight: "600" },
});
