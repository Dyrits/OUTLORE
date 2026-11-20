import type { HarnessName, Question } from "@outlore/contracts";
import { StyleSheet, Text, View } from "react-native";
import { clockOf, harnessLabels, stampOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { colors } from "../foundation/theme";
import { ProviderMark } from "../ui/providerMarks";
import { type BubbleOption, bubblesOf, type ChoiceBubble } from "./choiceBubbles";

const local = StyleSheet.create({
  /** An option the owner did not choose, once the choice is settled. */
  unchosen: { opacity: 0.55 },
  /** A chip never outgrows the bubble: a long label or typed answer wraps inside it. */
  wrapped: { flexShrink: 1, maxWidth: "100%" },
});

/** What a bubble says of how its question ended, with the time and the device that answered. */
const footOf = (bubble: ChoiceBubble, question: Question) =>
  [
    bubble.outcome,
    question.resolvedAt === null ? null : clockOf(question.resolvedAt),
    bubble.outcome === "Answered" ? question.device : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");

function OptionChip({ option }: { option: BubbleOption }) {
  return (
    <View
      accessibilityLabel={option.label}
      accessibilityState={{ selected: option.isChosen }}
      style={[styles.answer, local.wrapped, option.isChosen ? styles.answerPrimary : local.unchosen]}
    >
      <Text style={styles.answerText}>{option.label}</Text>
    </View>
  );
}

/** One choice a thread asked, as the agent's bubble: its question and options, with the owner's answer attached under them. */
function ChoiceBubbleView({
  bubble,
  harness,
  question,
}: {
  bubble: ChoiceBubble;
  harness: HarnessName;
  question: Question;
}) {
  const chosen = bubble.options.filter((option) => option.isChosen && option.description !== "");
  return (
    <View style={[styles.messageRow, styles.messageRowAgent]}>
      <View style={[styles.messageCard, styles.messageCardAgent, styles.messageCardNotched]}>
        <View style={styles.medallion}>
          <ProviderMark harness={harness} size={20} />
        </View>
        <View style={styles.senderHeader}>
          <Text style={styles.senderName}>{harnessLabels[harness]}</Text>
          <Text style={styles.senderTime}>{stampOf(question.askedAt)}</Text>
        </View>
        {bubble.header !== "" && <Text style={styles.muted}>{bubble.header}</Text>}
        <Text style={styles.questionText}>{bubble.question}</Text>
        <View style={styles.chips}>
          {bubble.options.map((option) => (
            <OptionChip key={option.label} option={option} />
          ))}
          {bubble.ownWords.map((text) => (
            <View
              accessibilityState={{ selected: true }}
              key={text}
              style={[styles.answer, local.wrapped, styles.answerPrimary]}
            >
              <Text style={styles.answerText}>{text}</Text>
            </View>
          ))}
        </View>
        {chosen.map((option) => (
          <Text key={option.label} style={[styles.muted, { color: colors.textSecondary }]}>
            {option.label}: {option.description}
          </Text>
        ))}
        <Text style={styles.muted}>{footOf(bubble, question)}</Text>
      </View>
    </View>
  );
}

/** A settled choice question: one agent bubble per choice, in the order asked, each with the owner's answer attached. */
export function ChoiceBubbles({ harness, question }: { harness: HarnessName; question: Question }) {
  return (
    <View>
      {bubblesOf(question).map((bubble) => (
        <ChoiceBubbleView bubble={bubble} harness={harness} key={bubble.key} question={question} />
      ))}
    </View>
  );
}
