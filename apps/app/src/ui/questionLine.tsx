import type { Question, QuestionOutcome } from "@outlore/contracts";
import { Text, View } from "react-native";
import { clockOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { answeredLineOf } from "./questionAnswers";

const outcomeLabels = {
  Allowed: "Allowed",
  AllowedAutomatically: "Ran",
  AllowedByMessage: "Allowed by your message",
  AllowedByPermission: "Allowed by a standing permission",
  AlwaysAllowed: "Always allowed",
  Answered: "Answered",
  Denied: "Denied",
  Discarded: "Discarded",
  Skipped: "Skipped",
  Withdrawn: "Withdrawn",
} as const satisfies Record<QuestionOutcome, string>;

const lineLength = 80;

/** The first line of a command or target, cut to fit a short line; Show details keeps the whole. */
const shortDetailOf = (details: string) => {
  const [first = ""] = details.trim().split("\n");
  return first.length > lineLength || first !== details.trim() ? `${first.slice(0, lineLength).trimEnd()}…` : first;
};

/** What a line says of a question: an action in plain words, a choice with its answers, or the command. */
const lineTextOf = (question: Question) => {
  // An action run without a question is told in plain words; its command stays in the history.
  if (question.outcome === "AllowedAutomatically") return question.summary.replace(/\.$/, "");
  if (question.choices !== null)
    return question.answers === null
      ? shortDetailOf(question.details)
      : shortDetailOf(answeredLineOf(question.choices, question.answers));
  return shortDetailOf(question.details);
};

/** The short line an answered or withdrawn question, or an action run without one, leaves in its thread. */
export function QuestionLine({ question }: { question: Question }) {
  const parts = [
    question.outcome === null ? "Open" : outcomeLabels[question.outcome],
    lineTextOf(question),
    question.resolvedAt === null ? null : clockOf(question.resolvedAt),
    question.device,
  ].filter((part) => part !== null);
  return (
    <View style={styles.questionLine}>
      <Text style={styles.muted}>{parts.join(" · ")}</Text>
      {question.message !== null && <Text style={styles.muted}>{question.message}</Text>}
    </View>
  );
}
