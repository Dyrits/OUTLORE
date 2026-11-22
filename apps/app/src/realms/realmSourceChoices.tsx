import { Pressable, StyleSheet, Text } from "react-native";
import { colors, fontSizes, fonts, outline, radii } from "../foundation/theme";

const sources = [
  { detail: "Start a new Git repository", id: "Project", title: "New project" },
  { detail: "Use an existing folder on the host", id: "Folder", title: "Local folder" },
  { detail: "Clone a repository from a URL", id: "GitUrl", title: "Git URL" },
  { detail: "Clone a GitHub repository by owner and name", id: "GitHub", title: "GitHub repository" },
  { detail: "Create a realm with no linked folder", id: "Empty", title: "Empty realm" },
] as const;

/** Where a new realm gets its workspace, if it has one. */
export type RealmSource = (typeof sources)[number]["id"];

/** Opens the details step for each of the available realm sources. */
export function RealmSourceChoices({ onChoose }: { onChoose: (source: RealmSource) => void }) {
  return sources.map(({ id, title, detail }) => (
    <Pressable
      accessibilityRole="button"
      key={id}
      onPress={() => onChoose(id)}
      style={({ pressed }) => [local.choice, pressed && local.pressed]}
    >
      <Text style={local.title}>{title}</Text>
      <Text style={local.detail}>{detail}</Text>
    </Pressable>
  ));
}

const local = StyleSheet.create({
  choice: {
    ...outline,
    backgroundColor: colors.canvas,
    borderRadius: radii.sm,
    gap: 3,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  detail: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm },
  pressed: { backgroundColor: colors.controlActive },
  title: { color: colors.text, fontFamily: fonts.sans, fontSize: fontSizes.base, fontWeight: "600" },
});
