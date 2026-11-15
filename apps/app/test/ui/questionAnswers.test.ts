import type { Choice, Question } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  answeredLineOf,
  answerOf,
  answersOf,
  answersOfDrafts,
  type ChoiceDraft,
  emptyDraft,
  pickOption,
  pickOther,
  typeOther,
} from "../../src/ui/questionAnswers";

const question = (fields: Pick<Question, "pattern" | "permission">) => fields;

describe("the answers a question card offers", () => {
  it("offers Always allow when the answer can save a standing permission", () => {
    expect(answersOf(question({ pattern: "git push origin main", permission: "Run this exact command" }))).toEqual([
      "Allow",
      "AlwaysAllow",
      "Deny",
    ]);
  });

  it("offers only Allow and Deny for a one-time question, such as a thread folder that is a link", () => {
    expect(answersOf(question({ pattern: null, permission: null }))).toEqual(["Allow", "Deny"]);
  });
});

const single: Choice = {
  allowsOther: true,
  header: "Build",
  multiple: false,
  options: [
    { description: "x", label: "A" },
    { description: "y", label: "B" },
  ],
  question: "Which build?",
};
const several: Choice = { ...single, header: "Targets", multiple: true, question: "Which targets?" };

describe("choosing answers to a choice question", () => {
  it("answers a single choice with the one option last picked", () => {
    const picked = pickOption(single, pickOption(single, emptyDraft, "A"), "B");
    expect(answerOf(single, picked)).toEqual(["B"]);
  });

  it("toggles the options of a multiple choice, keeping the options' order of picking", () => {
    let draft = pickOption(several, emptyDraft, "B");
    draft = pickOption(several, draft, "A");
    expect(answerOf(several, draft)).toEqual(["B", "A"]);
    expect(answerOf(several, pickOption(several, draft, "B"))).toEqual(["A"]);
  });

  it("answers with the typed text when Other is chosen, replacing the option of a single choice", () => {
    const typed = typeOther(pickOther(single, pickOption(single, emptyDraft, "A")), "  Neither  ");
    expect(answerOf(single, typed)).toEqual(["Neither"]);
  });

  it("adds the typed text to the options of a multiple choice", () => {
    const typed = typeOther(pickOther(several, pickOption(several, emptyDraft, "A")), "Watch");
    expect(answerOf(several, typed)).toEqual(["A", "Watch"]);
  });

  it("is not ready to send until every choice has an answer, and Other has text", () => {
    expect(answersOfDrafts([single, several], [emptyDraft, emptyDraft])).toBeNull();
    const half = [pickOption(single, emptyDraft, "A"), pickOther(several, emptyDraft)];
    expect(answersOfDrafts([single, several], half)).toBeNull();
    const full = [half[0] as ChoiceDraft, typeOther(half[1] as ChoiceDraft, "Watch")];
    expect(answersOfDrafts([single, several], full)).toEqual([["A"], ["Watch"]]);
  });

  it("says what was answered in a line of the thread: each question with its answer", () => {
    expect(answeredLineOf([single, several], [["B"], ["Mac", "Phone"]])).toBe(
      "Which build? B · Which targets? Mac, Phone",
    );
  });
});
