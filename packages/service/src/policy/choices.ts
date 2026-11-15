import type { Choice } from "@outlore/contracts";
import { fieldOf, textFieldOf } from "../core/index.ts";

/** The questions of a harness prompt that asks the owner to choose, or null when the prompt is not one. */
export const choicesOfPrompt = (toolName: string, input: unknown): ReadonlyArray<Choice> | null => {
  // Claude Code's AskUserQuestion (header, question, options, multiSelect); Codex's request_user_input and OpenCode's
  // question tool carry the same fields, and would map onto Choice in their adapters (CHG-0299).
  if (toolName !== "AskUserQuestion") return null;
  const asked = fieldOf(input, "questions");
  if (!Array.isArray(asked) || asked.length === 0) return null;
  const choices: Choice[] = [];
  for (const entry of asked) {
    const question = textFieldOf(entry, "question");
    const options = fieldOf(entry, "options");
    if (question === null || !Array.isArray(options)) return null;
    const parsed = options.map((option) => ({
      description: textFieldOf(option, "description") ?? "",
      label: textFieldOf(option, "label") ?? "",
    }));
    if (parsed.some((option) => option.label === "")) return null;
    choices.push({
      // Claude Code always lets the owner type an answer of their own.
      allowsOther: true,
      header: textFieldOf(entry, "header") ?? "",
      multiple: fieldOf(entry, "multiSelect") === true,
      options: parsed,
      question,
    });
  }
  return choices;
};

/** Why these answers do not fit the choices, or null: one list per choice, one entry unless it is multiple. */
export const answersProblemOf = (
  choices: ReadonlyArray<Choice>,
  answers: ReadonlyArray<ReadonlyArray<string>>,
): string | null => {
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
