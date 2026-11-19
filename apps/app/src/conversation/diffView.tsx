import type { DiffLineKind, FileDiff } from "@outlore/contracts";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, radii } from "../foundation/theme";

/** The mark in a line's margin, and the colors the line takes, by what the line is. */
const lineLooks = {
  Added: { background: colors.successSoft, ink: colors.successText, mark: "+" },
  Context: { background: "transparent", ink: colors.textMuted, mark: " " },
  Gap: { background: "transparent", ink: colors.textDim, mark: " " },
  Removed: { background: colors.dangerSoft, ink: colors.dangerText, mark: "−" },
} satisfies Record<DiffLineKind, { background: string; ink: string; mark: string }>;

/**
 * A modified file's diff as a unified view: added lines green, removed lines red, a little context between. Long lines
 * wrap, so it reads on a phone as in a window; the colors come from the palette, so every look has its own.
 */
export function DiffView({ diff }: { diff: FileDiff }) {
  return (
    <View style={local.box}>
      {diff.lines.map((line, index) => {
        const look = lineLooks[line.kind];
        return (
          // A diff has no ids and never reorders, so a line's position keys it.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above.
          <View key={index} style={[local.line, { backgroundColor: look.background }]}>
            <Text style={[local.mark, { color: look.ink }]}>{look.mark}</Text>
            <Text style={[local.text, { color: look.ink }, line.kind === "Gap" && local.gap]}>{line.text}</Text>
          </View>
        );
      })}
      {diff.lines.length === 0 && diff.note === null && <Text style={local.note}>No lines changed.</Text>}
      {diff.note !== null && <Text style={local.note}>{diff.note}</Text>}
    </View>
  );
}

const local = StyleSheet.create({
  box: {
    alignSelf: "stretch",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginVertical: 4,
    overflow: "hidden",
  },
  gap: { fontStyle: "italic" },
  line: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 1 },
  mark: { fontFamily: fonts.mono, fontSize: fontSizes.sm, width: 14 },
  note: { color: colors.textMuted, fontFamily: fonts.sans, fontSize: fontSizes.sm, fontStyle: "italic", padding: 8 },
  text: { flex: 1, fontFamily: fonts.mono, fontSize: fontSizes.sm },
});
