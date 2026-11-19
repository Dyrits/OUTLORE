import type { Choice, Question } from "@outlore/contracts";

/** One option of a bubble, with whether the owner chose it. */
export type BubbleOption = { description: string; isChosen: boolean; label: string };

/** How a choice question ended, as a bubble says it: the owner's answer, a skip, or a withdrawal. */
export type BubbleOutcome = "Answered" | "Skipped" | "Withdrawn";

/** One choice of a settled choice question, drawn as one agent bubble with the owner's answer attached (CHG-0535). */
export type ChoiceBubble = {
  header: string;
  /** Whether several options could be chosen. */
  isMultiple: boolean;
  key: string;
  options: ReadonlyArray<BubbleOption>;
  outcome: BubbleOutcome;
  /** What the owner typed instead of, or beside, the options. */
  ownWords: ReadonlyArray<string>;
  question: string;
};

/** The bubble's state for a settled question; anything but an answer or a skip counts as withdrawn. */
const outcomeOf = (question: Question): BubbleOutcome =>
  question.outcome === "Answered" ? "Answered" : question.outcome === "Skipped" ? "Skipped" : "Withdrawn";

const bubbleOf = (question: Question, choice: Choice, index: number): ChoiceBubble => {
  const answer = question.answers?.[index] ?? [];
  const labels = new Set(choice.options.map((option) => option.label));
  return {
    header: choice.header,
    isMultiple: choice.multiple,
    key: `${question.id}:${index}`,
    options: choice.options.map((option) => ({ ...option, isChosen: answer.includes(option.label) })),
    outcome: outcomeOf(question),
    ownWords: answer.filter((text) => !labels.has(text)),
    question: choice.question,
  };
};

/** The bubbles of a settled choice question, one per choice, in the order asked; none for any other question. */
export const bubblesOf = (question: Question): ReadonlyArray<ChoiceBubble> =>
  question.choices === null || question.outcome === null
    ? []
    : question.choices.map((choice, index) => bubbleOf(question, choice, index));
