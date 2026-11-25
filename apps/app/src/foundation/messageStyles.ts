import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts, outline, radii, round } from "./theme";
import { webStyleOf } from "./webStyle";

/** The shared look of the conversation: message cards, the composer, steps, notices, and questions. */
export const messageStyles = StyleSheet.create({
  anchoredReplies: { marginTop: 6 },
  /** The small gold button at a card's top right corner that opens the quest it speaks of. */
  cardCornerButton: {
    ...round,
    alignItems: "center",
    backgroundColor: colors.cornerButton,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: 12,
    top: 10,
    width: 34,
  },
  cardCornerButtonInline: { flexShrink: 0, position: "relative", right: 0, top: 0 },
  cardWithCorner: { paddingRight: 58 },
  /** The message box: one pill-shaped row that holds the text, the accessories, and the send button, and grows only as the text gains lines. */
  composer: { gap: 4, paddingBottom: 8 },
  /** The pickers under the message box, at its right. */
  composerAccessory: {
    alignItems: "center",
    columnGap: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
  },
  composerActions: { alignItems: "center", flexDirection: "row", flexShrink: 0, gap: 8 },
  composerField: { flex: 1, flexBasis: 200, justifyContent: "center", minWidth: 160 },
  composerInput: {
    color: colors.text,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    lineHeight: 20,
    maxHeight: 200,
    paddingHorizontal: 8,
    paddingVertical: 6,
    // Web only: no ring when focused; the pill around it is the field.
    ...webStyleOf({ outlineStyle: "none" }),
  },
  composerPill: {
    ...outline,
    alignItems: "flex-end",
    backgroundColor: colors.canvas,
    borderRadius: 14,
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
    rowGap: 4,
  },
  /** A conversation's messages, kept clear of the scrollbar that shows over their right edge. */
  feed: { paddingRight: 16 },
  /** The provider's medallion: a notch on the top left edge of an agent's reply, so the card keeps the full width. */
  medallion: {
    alignItems: "center",
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: "center",
    left: 12,
    position: "absolute",
    top: -16,
    width: 32,
    zIndex: 1,
  },
  /** A conversation card: a thin outline, with a background that tells who wrote it. */
  messageCard: {
    ...outline,
    ...round,
    flexShrink: 1,
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageCardAgent: { backgroundColor: colors.bubble },
  /** An agent's card leaves room under the medallion that sits on its top edge. */
  messageCardNotched: { paddingTop: 20 },
  messageCardNotice: { backgroundColor: colors.surface, gap: 8 },
  messageCardThread: { backgroundColor: colors.successSoft },
  messageCardUser: { backgroundColor: colors.bubbleUser },
  /** A message card and the reply lines anchored beneath it share one column so their edges align. */
  messageGroup: {
    alignItems: "stretch",
    alignSelf: "flex-start",
    flexDirection: "column",
    marginVertical: 6,
    maxWidth: "92%",
  },
  messageGroupAgent: { alignSelf: "stretch", marginTop: 22, maxWidth: "100%" },
  messageGroupUser: { alignSelf: "flex-end" },
  messageRow: { alignItems: "flex-start", flexDirection: "row", gap: 10, marginVertical: 6, maxWidth: "92%" },
  /** An agent's reply spans the row; its medallion sits above the card, which needs room above it. */
  messageRowAgent: { alignSelf: "stretch", flexDirection: "column", marginTop: 22, maxWidth: "100%" },
  messageRowUser: { alignSelf: "flex-end" },
  noticeHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    paddingBottom: 8,
  },
  noticeMetadata: { columnGap: 8, flex: 1, flexWrap: "wrap", rowGap: 2 },
  question: {
    ...round,
    backgroundColor: colors.warningSoft,
    borderColor: colors.danger,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  questionLine: { alignSelf: "flex-start", gap: 2, marginVertical: 6, maxWidth: "90%" },
  questionText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  /** Under a message: what it used or when it was sent on the left, its action icons on the right. */
  replyFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 20 },
  /** The composer's send button: a squircle ink stamp holding an arrow. */
  sendButton: {
    ...outline,
    alignItems: "center",
    backgroundColor: colors.edge,
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  senderHeader: { alignItems: "baseline", flexDirection: "row", gap: 8 },
  senderName: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "700" },
  senderTime: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  stepsCount: { color: colors.textSecondary, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  /** The line that opens or closes a turn's steps, and the working indicator's row. */
  stepsHeader: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 8, marginVertical: 6 },
  stepsList: {
    alignItems: "flex-start",
    borderLeftColor: colors.border,
    borderLeftWidth: 1,
    gap: 6,
    marginLeft: 6,
    paddingLeft: 12,
  },
  stepText: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.md, fontStyle: "italic" },
  /** The message a thread hangs from, pinned above its own messages: a quiet card, read-only. */
  threadRoot: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 4,
    marginVertical: 6,
    opacity: 0.9,
    padding: 12,
  },
  /** The line under the root that counts the replies, with a rule either side as in Slack's thread panel. */
  threadRootDivider: { alignItems: "center", alignSelf: "stretch", flexDirection: "row", gap: 10, marginVertical: 8 },
  threadRootRule: { backgroundColor: colors.border, flex: 1, height: 1 },
});
