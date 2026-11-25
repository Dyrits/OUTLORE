import { StyleSheet } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";

/** The look of the Remote access card and its relay choice. */
export const remoteAccessStyles = StyleSheet.create({
  codeBox: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  device: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  deviceText: { flex: 1, gap: 2 },
  input: {
    backgroundColor: colors.page,
    borderColor: colors.edge,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: fontSizes.md,
    padding: 8,
  },
  label: { color: colors.textDim, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  row: { alignItems: "center", flexDirection: "row", gap: 10 },
});
