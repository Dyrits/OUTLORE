import { Pressable, Text, View } from "react-native";
import { styles } from "../foundation/styles";
import { ChipIcon } from "./chips";
import { type MenuRow, mentionCategories } from "./mentionMenu";

/** The list a `$`, `+`, or `#` opens above the message box: headings, categories, and the rows to choose from. */
export function ComposerMenu({
  highlighted,
  onChoose,
  rows,
}: {
  /** The row the arrow keys are on; none before the owner moves to one. */
  highlighted: MenuRow | undefined;
  onChoose: (row: MenuRow) => void;
  rows: ReadonlyArray<MenuRow>;
}) {
  return (
    <View style={styles.skillList}>
      {rows.map((row) =>
        row.type === "heading" ? (
          <Text key={row.key} style={styles.mentionHeading}>
            {mentionCategories[row.category].label}
          </Text>
        ) : (
          <Pressable
            key={row.key}
            onPress={() => onChoose(row)}
            style={[styles.skillOption, row === highlighted && styles.skillOptionChosen]}
          >
            <ChipIcon kind={row.type === "category" ? mentionCategories[row.category].kind : row.chip.kind} />
            <Text style={styles.skillName}>
              {row.type === "category" ? mentionCategories[row.category].label : row.chip.label}
            </Text>
            <Text numberOfLines={1} style={styles.skillDescription}>
              {row.type === "category" ? "›" : row.description}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );
}
