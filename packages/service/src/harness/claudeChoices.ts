import type { Choice } from "@outlore/contracts";
import { Predicate } from "effect";
import { fieldOf, type PromptAnswer, textFieldOf } from "../core/index.ts";

/** The questions of a harness prompt that asks the owner to choose, or null when the prompt is not one. */
export const claudeChoicesOf = (toolName: string, input: unknown): ReadonlyArray<Choice> | null => {
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

/**
 * Claude Code's AskUserQuestion takes its answers back in `updatedInput.answers`: each question's text mapped to the
 * chosen labels or typed text, joined by ", " for a multiple choice (CHG-0299).
 */
const withAnswers = (input: unknown, answers: ReadonlyArray<ReadonlyArray<string>> | undefined) => {
  if (answers === undefined) return input;
  const questions = fieldOf(input, "questions");
  if (!Array.isArray(questions)) return input;
  return {
    ...(Predicate.isObject(input) ? input : {}),
    answers: Object.fromEntries(
      questions.map((entry, index) => [textFieldOf(entry, "question") ?? "", (answers[index] ?? []).join(", ")]),
    ),
  };
};

/** Claude Code's permission-tool response, including its own choice-answer encoding. */
export const claudePromptAnswerOf = (input: unknown, decision: PromptAnswer) =>
  JSON.stringify(
    decision.isAllowed
      ? { behavior: "allow", updatedInput: withAnswers(input, decision.answers) }
      : { behavior: "deny", message: decision.text },
  );
