import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";
import { expandedWidth } from "./railStorage";
/** How far each level of errands steps in, and the width of the chevron's place at the start of a row. */
export const indentStep = 14;
export const chevronWidth = 16;

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
  // A corner mark: a bottom and left border at the row's lower-left corner, rounded there. Its size, a share of the
  // row's width and height, is set where it is drawn.
  corner: {
    borderBottomLeftRadius: radii.md,
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
  count: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  diamond: {
    backgroundColor: colors.edge,
    height: 7,
    marginHorizontal: 6,
    transform: [{ rotate: "45deg" }],
    width: 7,
  },
  divider: { alignItems: "center", flexDirection: "row", marginHorizontal: 6, marginVertical: 8 },
  dividerLine: { backgroundColor: colors.border, flex: 1, height: 1 },
  dot: { borderRadius: radii.pill, height: 8, width: 8 },
  empty: {
    color: colors.textMuted,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  // A group with nothing in it yet: the sidebar's two sections, and a realm without quests. Muted, italic, and in
  // line with the text of the rows the group would list.
  emptyGroup: {
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
  questError: { color: colors.dangerText, fontFamily: fonts.sans, fontSize: fontSizes.sm, paddingVertical: 2 },
  /** The fixed place at the end of a quest row: its state dot, or on hover its archive or delete mark. */
  questMark: { alignItems: "center", height: 18, justifyContent: "center", width: 18 },
  // A realm's name takes the width it needs and shrinks when the row is short. It must not be built on `rowText`: that
  // carries `flex: 1`, and Yoga (the phone's layout) reads `flexBasis: "auto"` as unset and so takes `flex`'s basis of 0,
  // which left the name no width on a phone while the web build, following CSS, showed it.
  realmText: {
    color: colors.onGround,
    flexShrink: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.base,
    fontWeight: "600",
  },
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
  // A row of quests keeps a 1 px outline, clear unless a summons rings it; the padding gives that pixel back. The 1 px
  // margin below keeps a ring from touching the next row.
  rowQuest: { borderColor: "transparent", borderWidth: 1, marginBottom: 1, paddingRight: 7, paddingVertical: 3 },
  rowSelected: { backgroundColor: colors.controlActive },
  rowText: { color: colors.onGround, flex: 1, fontFamily: fonts.sans, fontSize: fontSizes.base },
  rowTextSelected: { color: colors.text, fontWeight: "600" },
  // A finger needs a taller target than a pointer: rows on a device that cannot hover.
  rowTouch: { minHeight: 40 },
  // A section's label row: the height and text size of the sidebar's other rows, so Realms and Borderlands read as rows.
  sectionRow: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    gap: 4,
    minHeight: 28,
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
  },
  sectionTitle: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
  sidebar: {
    backgroundColor: colors.sidebar,
    borderRightColor: colors.border,
    borderRightWidth: 1,
    width: expandedWidth,
  },
  sideQuestText: { fontSize: fontSizes.md },
  spending: { paddingHorizontal: 6, paddingVertical: 4 },
});
