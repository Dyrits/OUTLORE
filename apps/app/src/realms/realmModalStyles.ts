import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";

/** Layout and theme tokens for the realm creation dialog. */
export const realmModalStyles = StyleSheet.create({
  backdrop: {
    alignItems: "center",
    backgroundColor: "rgba(5,10,18,0.7)",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  error: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.md },
  folderRow: { alignItems: "center", flexDirection: "row", gap: 10, justifyContent: "space-between" },
  menu: {
    ...outline,
    backgroundColor: colors.page,
    borderRadius: radii.xl,
    gap: 12,
    padding: 20,
  },
  menuButton: {
    ...outline,
    alignSelf: "flex-start",
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  menuButtonText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  menuDone: { backgroundColor: colors.accent, borderRadius: radii.sm, paddingHorizontal: 18, paddingVertical: 8 },
  menuDoneOff: { opacity: 0.4 },
  menuDoneText: { color: colors.onAccent, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "700" },
  menuFields: { flex: 1, gap: 8 },
  menuFooter: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  menuLabel: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: 12 },
  menuPath: { color: colors.textMuted, flex: 1, fontFamily: fonts.mono, fontSize: fontSizes.sm },
  menuPathEmpty: { fontFamily: fonts.sans, fontStyle: "italic" },
  menuTitle: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.xl, fontWeight: "700" },
  nameInput: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    color: colors.text,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    minWidth: 160,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  namingRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 10 },
  scroll: { flexGrow: 0, maxWidth: 480, width: "100%" },
});
