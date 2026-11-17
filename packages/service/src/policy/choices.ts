import type { Choice, ChoiceAnswers } from "@outlore/contracts";

/** Why these answers do not fit the choices, or null: one list per choice, one entry unless it is multiple. */
export const answersProblemOf = (choices: ReadonlyArray<Choice>, answers: ChoiceAnswers): string | null => {
  if (answers.length !== choices.length) return `Answer all ${choices.length} questions.`;
  for (const [index, choice] of choices.entries()) {
    const given = answers[index] ?? [];
    if (given.length === 0 || given.some((text) => text.trim() === "")) return `Answer “${choice.question}”.`;
    if (!choice.multiple && given.length !== 1) return `Choose one answer to “${choice.question}”.`;
    if (!choice.allowsOther && given.some((text) => !choice.options.some((option) => option.label === text)))
      return `“${choice.question}” takes one of its options.`;
  }
  return null;
};
