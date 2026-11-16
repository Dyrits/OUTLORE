import type { Answer, Choice, Question, QuestionOutcome } from "@outlore/contracts";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { messageOf, type ServiceClient } from "../foundation/client";
import { clockOf } from "../foundation/formatting";
import { styles } from "../foundation/styles";
import { choiceActions } from "./choiceCard";
import {
  answeredLineOf,
  answersOf,
  type ChoiceDraft,
  emptyDraft,
  pickOption,
  pickOther,
  typeOther,
} from "./questionAnswers";

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

function AnswerButton({
  label,
  onPress,
  isPrimary = false,
}: {
  label: string;
  onPress: () => void;
  isPrimary?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.answer, isPrimary && styles.answerPrimary]}>
      <Text style={[styles.answerText, isPrimary && styles.answerTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

/** One choice of a choice question: its options to pick, and a field to type an answer of the owner's own. */
function ChoiceInput({
  choice,
  draft,
  onChange,
}: {
  choice: Choice;
  draft: ChoiceDraft;
  onChange: (draft: ChoiceDraft) => void;
}) {
  return (
    <View style={styles.details}>
      {choice.header !== "" && <Text style={styles.muted}>{choice.header}</Text>}
      <Text style={styles.questionText}>{choice.question}</Text>
      {choice.multiple && <Text style={styles.muted}>Choose any number.</Text>}
      <View style={styles.chips}>
        {choice.options.map((option) => (
          <Pressable
            accessibilityLabel={option.label}
            accessibilityRole={choice.multiple ? "checkbox" : "radio"}
            accessibilityState={{ selected: draft.selected.includes(option.label) }}
            key={option.label}
            onPress={() => onChange(pickOption(choice, draft, option.label))}
            style={[styles.answer, draft.selected.includes(option.label) && styles.answerPrimary]}
          >
            <Text style={[styles.answerText, draft.selected.includes(option.label) && styles.answerTextPrimary]}>
              {option.label}
            </Text>
            {option.description !== "" && <Text style={styles.muted}>{option.description}</Text>}
          </Pressable>
        ))}
        {choice.allowsOther && (
          <Pressable
            accessibilityLabel="Other"
            accessibilityRole={choice.multiple ? "checkbox" : "radio"}
            accessibilityState={{ selected: draft.isOtherChosen }}
            onPress={() => onChange(pickOther(choice, draft))}
            style={[styles.answer, draft.isOtherChosen && styles.answerPrimary]}
          >
            <Text style={[styles.answerText, draft.isOtherChosen && styles.answerTextPrimary]}>Other</Text>
          </Pressable>
        )}
      </View>
      {draft.isOtherChosen && (
        <TextInput
          accessibilityLabel={`Your own answer to ${choice.question}`}
          onChangeText={(text) => onChange(typeOther(draft, text))}
          placeholder="Your own answer"
          style={styles.input}
          value={draft.other}
        />
      )}
    </View>
  );
}

/** An open choice question: every choice to answer, then Send, or Skip to leave it unanswered (CHG-0299). */
function ChoiceCard({
  choices,
  client,
  question,
  onOpenMission,
}: {
  choices: ReadonlyArray<Choice>;
  client: ServiceClient;
  question: Question;
  onOpenMission?: () => void;
}) {
  const [drafts, setDrafts] = useState<ReadonlyArray<ChoiceDraft>>(() => choices.map(() => emptyDraft));
  const [error, setError] = useState<string | null>(null);
  const actions = choiceActions(
    choices,
    drafts,
    (answers) => client.request({ _tag: "AnswerChoices", answers, questionId: question.id }),
    setError,
  );
  return (
    <View style={styles.question}>
      {onOpenMission !== void 0 && (
        <Pressable onPress={onOpenMission}>
          <Text numberOfLines={1} style={styles.link}>
            {question.missionTitle}
          </Text>
        </Pressable>
      )}
      {choices.map((choice, index) => (
        <ChoiceInput
          choice={choice}
          draft={drafts[index] ?? emptyDraft}
          key={choice.question}
          onChange={(draft) => setDrafts(drafts.map((current, at) => (at === index ? draft : current)))}
        />
      ))}
      <View style={styles.chips}>
        <Pressable
          accessibilityState={{ disabled: actions.isSendDisabled }}
          disabled={actions.isSendDisabled}
          onPress={actions.send}
          style={[styles.answer, styles.answerPrimary, actions.isSendDisabled && { opacity: 0.4 }]}
        >
          <Text style={[styles.answerText, styles.answerTextPrimary]}>Send</Text>
        </Pressable>
        <AnswerButton label="Skip" onPress={actions.skip} />
      </View>
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** An open question: its choices to answer, or an action with its buttons; outside its thread it also names its mission. */
export function QuestionCard({
  client,
  question,
  onOpenMission,
}: {
  client: ServiceClient;
  question: Question;
  onOpenMission?: () => void;
}) {
  return question.choices === null ? (
    <ActionCard client={client} onOpenMission={onOpenMission} question={question} />
  ) : (
    <ChoiceCard choices={question.choices} client={client} onOpenMission={onOpenMission} question={question} />
  );
}

/** An open approval question with its buttons. */
function ActionCard({
  client,
  question,
  onOpenMission,
}: {
  client: ServiceClient;
  question: Question;
  onOpenMission?: () => void;
}) {
  const [isShowingDetails, setIsShowingDetails] = useState(false);
  const [denial, setDenial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const send = (answer: Answer, message: string | null = null) =>
    client.request({ _tag: "AnswerQuestion", answer, message, questionId: question.id }).then(
      () => setError(null),
      (reason) => setError(messageOf(reason)),
    );
  return (
    <View style={styles.question}>
      {onOpenMission !== void 0 && (
        <Pressable onPress={onOpenMission}>
          <Text numberOfLines={1} style={styles.link}>
            {question.missionTitle}
          </Text>
        </Pressable>
      )}
      <Text style={styles.questionText}>{question.summary}</Text>
      <Pressable onPress={() => setIsShowingDetails(!isShowingDetails)}>
        <Text style={styles.link}>{isShowingDetails ? "Hide details" : "Show details"}</Text>
      </Pressable>
      {isShowingDetails && (
        <View style={styles.details}>
          <Text style={styles.code}>{question.details}</Text>
          {question.permission !== null && (
            <Text style={styles.muted}>
              Always allow saves: {question.permission}
              {question.pattern === null ? "" : ` (${question.pattern})`}
            </Text>
          )}
        </View>
      )}
      <View style={styles.chips}>
        <AnswerButton isPrimary label="Allow" onPress={() => send("Allow")} />
        {answersOf(question).includes("AlwaysAllow") && (
          <AnswerButton label="Always allow" onPress={() => send("AlwaysAllow")} />
        )}
        <AnswerButton label="Deny" onPress={() => send("Deny", denial.trim() === "" ? null : denial)} />
      </View>
      <TextInput
        onChangeText={setDenial}
        placeholder="Optional, with Deny: why, or what to do instead"
        style={styles.input}
        value={denial}
      />
      {error !== null && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
