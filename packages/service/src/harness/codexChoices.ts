import type { Choice } from "@outlore/contracts";
import { Schema } from "effect";

const Question = Schema.Struct({
  header: Schema.String,
  id: Schema.String,
  isOther: Schema.Boolean,
  isSecret: Schema.Boolean,
  options: Schema.NullOr(Schema.Array(Schema.Struct({ description: Schema.String, label: Schema.String }))),
  question: Schema.String,
});
const decode = Schema.decodeUnknownOption(Schema.Struct({ questions: Schema.Array(Question) }));

/** Codex 0.169.0's requestUserInput; secret answers need a private UI before they can be supported. */
export const codexChoicesOf = (input: unknown) => {
  const parsed = decode(input);
  if (
    parsed._tag === "None" ||
    parsed.value.questions.length === 0 ||
    parsed.value.questions.some((question) => question.isSecret)
  )
    return null;
  return parsed.value.questions.map((question) => ({
    choice: {
      allowsOther: question.isOther || question.options === null,
      header: question.header,
      multiple: false,
      options: question.options ?? [],
      question: question.question,
    } satisfies typeof Choice.Type,
    id: question.id,
  }));
};

/** Codex answers are keyed by question id, each containing a list of the owner's answers. */
export const codexAnswersOf = (
  questions: ReadonlyArray<{ readonly id: string }>,
  answers: ReadonlyArray<ReadonlyArray<string>> | null,
) => ({
  answers:
    answers === null
      ? {}
      : Object.fromEntries(questions.map((question, index) => [question.id, { answers: answers[index] ?? [] }])),
});
