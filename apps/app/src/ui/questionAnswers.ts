import type { Answer, Choice, Question } from "@outlore/contracts";

/**
 * The answers a question card offers. Always allow saves the question's permission and pattern, so a question with
 * neither (a one-time confirmation, such as a thread folder that is a link) offers only Allow and Deny, as the service
 * refuses Always allow for it.
 */
export const answersOf = (question: Pick<Question, "pattern" | "permission">): ReadonlyArray<Answer> =>
  question.pattern === null || question.permission === null ? ["Allow", "Deny"] : ["Allow", "AlwaysAllow", "Deny"];

/** What the owner has picked so far for one choice of a choice question (CHG-0299). */
export type ChoiceDraft = {
  /** Whether Other is chosen: its typed text then counts as an answer. */
  readonly isOtherChosen: boolean;
  readonly other: string;
  /** The options picked, in the order picked. */
  readonly selected: ReadonlyArray<string>;
};

export const emptyDraft: ChoiceDraft = { isOtherChosen: false, other: "", selected: [] };

/** Picks an option: replaces the pick of a single choice (dropping Other), toggles it in a multiple one. */
export const pickOption = (choice: Choice, draft: ChoiceDraft, label: string): ChoiceDraft =>
  choice.multiple
    ? {
        ...draft,
        selected: draft.selected.includes(label)
          ? draft.selected.filter((picked) => picked !== label)
          : [...draft.selected, label],
      }
    : { ...draft, isOtherChosen: false, selected: [label] };

/** Chooses Other: replaces the pick of a single choice, toggles in a multiple one. */
export const pickOther = (choice: Choice, draft: ChoiceDraft): ChoiceDraft =>
  choice.multiple ? { ...draft, isOtherChosen: !draft.isOtherChosen } : { ...draft, isOtherChosen: true, selected: [] };

export const typeOther = (draft: ChoiceDraft, other: string): ChoiceDraft => ({ ...draft, other });

/** The answer a draft gives: the options picked, then the typed text when Other is chosen and not blank. */
export const answerOf = (draft: ChoiceDraft): ReadonlyArray<string> => [
  ...draft.selected,
  ...(draft.isOtherChosen && draft.other.trim() !== "" ? [draft.other.trim()] : []),
];

/** The answers to send, or null while a choice has none (Other chosen with no text counts as none). */
export const answersOfDrafts = (
  choices: ReadonlyArray<Choice>,
  drafts: ReadonlyArray<ChoiceDraft>,
): ReadonlyArray<ReadonlyArray<string>> | null => {
  const answers = choices.map((_, index) => answerOf(drafts[index] ?? emptyDraft));
  return answers.some((answer) => answer.length === 0) ? null : answers;
};

/** The line a thread keeps of an answered choice question: each question with what was answered. */
export const answeredLineOf = (choices: ReadonlyArray<Choice>, answers: ReadonlyArray<ReadonlyArray<string>>): string =>
  choices.map((choice, index) => `${choice.question} ${(answers[index] ?? []).join(", ")}`).join(" · ");
