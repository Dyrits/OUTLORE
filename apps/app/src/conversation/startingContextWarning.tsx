import type { ModelChoice, StartingContext } from "@outlore/contracts";
import { Pressable, Text, View } from "react-native";
import { modelLabelOf } from "../foundation/formatting";
import { startingContextPartsOf, startingContextWarningOf } from "../foundation/labels";
import { styles } from "../foundation/styles";

/**
 * The warning that a starting context takes more than a quarter of the model's window (thread-tree, Opening a thread):
 * what it holds, and the way out by a model with a larger window or by trimming lore. Where it stands decides what
 * the two buttons change, so each is given.
 */
export function StartingContextWarning({
  context,
  onChooseModel,
  onTrim,
}: {
  context: StartingContext;
  onChooseModel: (model: ModelChoice) => void;
  onTrim: () => void;
}) {
  return (
    <View style={styles.failure}>
      <Text style={styles.error}>{startingContextWarningOf(context)}</Text>
      <Text style={styles.muted}>{startingContextPartsOf(context.parts)}</Text>
      <View style={styles.inlineRow}>
        {context.largerModels.length === 0 ? (
          <Text style={styles.muted}>No model has a larger context window.</Text>
        ) : (
          context.largerModels.map((larger) => (
            <Pressable key={larger} onPress={() => onChooseModel(larger)} style={styles.answer}>
              <Text style={styles.answerText}>Use {modelLabelOf(larger)}</Text>
            </Pressable>
          ))
        )}
        <Pressable onPress={onTrim} style={styles.answer}>
          <Text style={styles.answerText}>Trim lore</Text>
        </Pressable>
      </View>
    </View>
  );
}
