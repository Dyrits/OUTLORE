import { Pressable, Text, View } from "react-native";
import { type Runner, RunnerPickers, useHarnesses } from "../editors/runners";
import type { ServiceClient } from "../foundation/client";
import { styles } from "../foundation/styles";
import { ritualStyles } from "./ritualStyles";
import { Part, Word } from "./scheduleRow";

export function RitualCompanionFields({
  client,
  fallbacks,
  onFallbacks,
  onPrimary,
  primary,
}: {
  client: ServiceClient;
  fallbacks: ReadonlyArray<Runner>;
  onFallbacks: (fallbacks: ReadonlyArray<Runner>) => void;
  onPrimary: (primary: Runner) => void;
  primary: Runner;
}) {
  const { data: harnesses } = useHarnesses(client);
  const addFallback = () => {
    // The first harness other than the primary's, on its first listed model.
    const other = harnesses?.harnesses.find((candidate) => candidate.name !== primary.harness);
    onFallbacks([
      ...fallbacks,
      {
        accountId: null,
        effort: "default",
        harness: other?.name ?? "codex",
        model: other?.models[0]?.id ?? "default",
      },
    ]);
  };
  return (
    <>
      <Part name="Companion">
        <RunnerPickers
          client={client}
          harnesses={harnesses}
          isCompact={false}
          isPanel
          onChange={onPrimary}
          value={primary}
        />
      </Part>
      <Part name="If a run fails, fall back to">
        {fallbacks.map((fallback, index) => (
          // A fallback has no identity but its place in the list.
          // biome-ignore lint/suspicious/noArrayIndexKey: see above
          <View key={index}>
            <View style={ritualStyles.sentence}>
              <Word text={index === 0 ? "first" : "then"} />
              <View style={styles.flex} />
              <Pressable
                accessibilityLabel={`Remove fallback ${index + 1}`}
                accessibilityRole="button"
                onPress={() => onFallbacks(fallbacks.filter((_, other) => other !== index))}
              >
                <Text style={ritualStyles.remove}>Remove</Text>
              </Pressable>
            </View>
            <RunnerPickers
              client={client}
              harnesses={harnesses}
              isCompact={false}
              isPanel
              onChange={(next) => onFallbacks(fallbacks.map((current, other) => (other === index ? next : current)))}
              value={fallback}
            />
          </View>
        ))}
        {fallbacks.length < 5 && (
          <Pressable accessibilityRole="button" onPress={addFallback}>
            <Text style={styles.link}>+ Add a fallback Companion</Text>
          </Pressable>
        )}
      </Part>
    </>
  );
}
