import type { ThreadId } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { ServiceClient } from "../foundation/client";
import { spanOf } from "../foundation/formatting";
import { countedOf } from "../foundation/labels";
import { styles } from "../foundation/styles";
import { QuestionLine } from "../ui/questions";
import { CallStep } from "./callStep";
import type { Step } from "./entries";

/** A turn's settled actions and reported tool calls, folded under "2 steps · 16s" and listed when opened. */
export function StepsGroup({
  client,
  seconds,
  steps,
  threadId,
}: {
  client: ServiceClient;
  seconds: number;
  steps: ReadonlyArray<Step>;
  threadId: ThreadId;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityLabel={`${countedOf(steps.length, "step")}, ${spanOf(seconds)}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(!isOpen)}
        style={styles.stepsHeader}
      >
        <Text style={styles.stepsCount}>{countedOf(steps.length, "step")}</Text>
        <Text style={styles.muted}>{spanOf(seconds)}</Text>
        <Text style={styles.muted}>{isOpen ? "⌃" : "⌄"}</Text>
      </Pressable>
      {isOpen && (
        <View style={styles.stepsList}>
          {steps.map((step) =>
            step._tag === "Action" ? (
              <QuestionLine key={step.id} question={step.question} />
            ) : (
              <CallStep activity={step.activity} at={step.at} client={client} key={step.id} threadId={threadId} />
            ),
          )}
        </View>
      )}
    </View>
  );
}
