import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { expandedWidth } from "./railStorage";
/** How far each level of errands steps in, and the width of the chevron's place at the start of a row. */
export const indentStep = 14;
export const chevronWidth = 16;
/** How many quests the sidebar lists under the Borderlands, and under each realm; the quest list page lists them all. */
export const borderlandsShown = 3;
export const realmShown = 3;

export const isHovered = (state: unknown) => (state as { hovered?: boolean }).hovered === true;

export const local = StyleSheet.create({
  actions: { alignItems: "center", flexDirection: "row", gap: 4 },
  // Unseen but in place: the row keeps its layout, and the keyboard can still reach the buttons.
  actionsHidden: { opacity: 0 },
  add: {
    alignItems: "center",
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 28,
    justifyContent: "center",
    marginLeft: 6,
    width: 28,
  },
  addHovered: { backgroundColor: colors.controlActive },
  chevron: { alignItems: "center", height: 20, justifyContent: "center", width: chevronWidth },
  count: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  creationDivider: { backgroundColor: colors.edge, height: 1, marginHorizontal: 6, marginVertical: 6 },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  emptyRealm: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    fontStyle: "italic",
    paddingLeft: 6 + chevronWidth,
    paddingVertical: 4,
  },
  flex: { flex: 1 },
  folderCue: { alignItems: "center", flexShrink: 0, justifyContent: "center" },
  // The same 1 px between rows as in the scrolling part, so a block's categories are evenly spaced everywhere.
  footer: { gap: 1, paddingBottom: 8, paddingLeft: 8, paddingRight: 16 },
  group: { gap: 1, paddingBottom: 12, paddingLeft: 8, paddingRight: 16, paddingTop: 8 },
  guide: { backgroundColor: colors.border, bottom: 0, position: "absolute", top: 0, width: 1 },
  menuRow: { alignItems: "flex-start", paddingLeft: 4 },
  more: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 6,
    minHeight: 28,
    paddingLeft: 6 + chevronWidth,
    paddingRight: 8,
    paddingVertical: 4,
  },
  moreArrow: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.base },
  moreText: { color: colors.highlight, fontFamily: fonts.sans, fontSize: fontSizes.md, fontWeight: "600" },
  newQuest: { alignItems: "center", borderRadius: radii.sm, height: 22, justifyContent: "center", width: 22 },
  newQuestFailure: {
    color: colors.dangerText,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    paddingLeft: 6 + chevronWidth,
    paddingVertical: 4,
  },
  newQuestHovered: { backgroundColor: colors.controlActive },
  realmsTitle: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    minHeight: 34,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  realmsTitleText: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.lg, fontWeight: "700" },
  realmText: { flexBasis: "auto", flexGrow: 0, flexShrink: 1, fontWeight: "600" },
  realmTextEnd: { flex: 1 },
  row: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 4,
    minHeight: 28,
    paddingRight: 8,
    paddingVertical: 4,
  },
  rowHovered: { backgroundColor: colors.controlHover },
  rowSelected: { backgroundColor: colors.controlActive },
  rowText: { color: colors.onGround, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
  rowTextSelected: { color: colors.text, fontWeight: "600" },
  sidebar: {
    backgroundColor: colors.sidebar,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    width: expandedWidth,
  },
  sideQuestText: { fontSize: fontSizes.md },
  spending: { paddingHorizontal: 6, paddingVertical: 4 },
});
