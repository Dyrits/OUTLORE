import { describe, expect, it } from "vitest";
import { codexAnswersOf, codexChoicesOf } from "../../src/harness/codexChoices.ts";

const input = {
  questions: [
    {
      header: "Build",
      id: "build",
      isOther: true,
      isSecret: false,
      options: [{ description: "First", label: "A" }],
      question: "Which build?",
    },
  ],
};
describe("translating Codex choices", () => {
  it("keeps the question id for the reply while giving the owner neutral choices", () => {
    const questions = codexChoicesOf(input);
    expect(questions).toEqual([
      {
        choice: {
          allowsOther: true,
          header: "Build",
          multiple: false,
          options: input.questions[0]?.options,
          question: "Which build?",
        },
        id: "build",
      },
    ]);
    expect(codexAnswersOf(questions ?? [], [["Something else"]])).toEqual({
      answers: { build: { answers: ["Something else"] } },
    });
  });
  it("returns no answers when the owner skips", () => {
    expect(codexAnswersOf([{ id: "build" }], null)).toEqual({ answers: {} });
  });
  it("allows text for a question without options", () => {
    expect(codexChoicesOf({ questions: [{ ...input.questions[0], options: null }] })?.[0]?.choice).toMatchObject({
      allowsOther: true,
      options: [],
    });
  });
  it("declines malformed and secret questions", () => {
    expect(codexChoicesOf({ questions: [{}] })).toBeNull();
    expect(codexChoicesOf({ questions: [{ ...input.questions[0], isSecret: true }] })).toBeNull();
  });
});
