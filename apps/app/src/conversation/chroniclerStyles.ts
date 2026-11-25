import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts } from "../foundation/theme";

/** Styles shared by the Chronicler conversation shell, header, and chat pane. */
export const chroniclerStyles = StyleSheet.create({
  body: { flex: 1 },
  chat: { flex: 1, gap: 8 },
  empty: { alignItems: "center", flex: 1, gap: 8, justifyContent: "center", paddingHorizontal: 24 },
  emptyText: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    maxWidth: 520,
    textAlign: "center",
  },
  emptyTitle: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  handoff: { gap: 6 },
  hidden: { display: "none" },
  link: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md },
  mobileTitle: { flexShrink: 1 },
  note: { alignItems: "center", flexDirection: "row", gap: 8 },
  noteClear: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.lg, paddingHorizontal: 4 },
  noteName: { color: colors.highlight, fontFamily: fonts.sans, fontWeight: "700" },
  noteText: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md },
  page: { backgroundColor: colors.page, flex: 1, gap: 8, paddingBottom: 14, paddingHorizontal: 16, paddingTop: 12 },
  sub: { color: colors.onGround, fontFamily: fonts.sans, fontSize: fontSizes.md, opacity: 0.8 },
});
