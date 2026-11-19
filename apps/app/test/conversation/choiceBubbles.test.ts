import { type Choice, MissionId, type Question, QuestionId, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { bubblesOf } from "../../src/conversation/choiceBubbles";

const choice = (question: string, labels: ReadonlyArray<string>, multiple = false): Choice => ({
  allowsOther: true,
  header: `H ${question}`,
  multiple,
  options: labels.map((label) => ({ description: `About ${label}`, label })),
  question,
});

const questionOf = (
  choices: ReadonlyArray<Choice> | null,
  outcome: Question["outcome"],
  answers: Question["answers"],
): Question => ({
  answers,
  askedAt: 1000,
  choices,
  details: "details",
  device: "Mac Mini",
  id: QuestionId.make("q"),
  message: null,
  missionId: MissionId.make("mission"),
  missionTitle: "Mission",
  outcome,
  pattern: null,
  permission: null,
  resolvedAt: 2000,
  source: "Harness",
  summary: "summary",
  threadId: ThreadId.make("top"),
  threadTitle: "Top",
});

describe("the bubbles of a settled choice question", () => {
  it("marks the option the owner chose", () => {
    const [bubble] = bubblesOf(questionOf([choice("Which build?", ["A", "B"])], "Answered", [["B"]]));
    expect(bubble).toMatchObject({
      header: "H Which build?",
      outcome: "Answered",
      ownWords: [],
      question: "Which build?",
    });
    expect(bubble?.options.map((option) => [option.label, option.isChosen])).toEqual([
      ["A", false],
      ["B", true],
    ]);
  });

  it("draws one bubble per choice, in the order asked", () => {
    const bubbles = bubblesOf(
      questionOf([choice("First?", ["A", "B"]), choice("Second?", ["C", "D"])], "Answered", [["A"], ["D"]]),
    );
    expect(
      bubbles.map((bubble) => [bubble.question, bubble.options.filter((o) => o.isChosen).map((o) => o.label)]),
    ).toEqual([
      ["First?", ["A"]],
      ["Second?", ["D"]],
    ]);
    expect(new Set(bubbles.map((bubble) => bubble.key)).size).toBe(2);
  });

  it("marks every option chosen in a multiple choice", () => {
    const [bubble] = bubblesOf(questionOf([choice("Which?", ["A", "B", "C"], true)], "Answered", [["A", "C"]]));
    expect(bubble?.isMultiple).toBe(true);
    expect(bubble?.options.filter((option) => option.isChosen).map((option) => option.label)).toEqual(["A", "C"]);
  });

  it("keeps the owner's own words apart from the options", () => {
    const [bubble] = bubblesOf(questionOf([choice("Which?", ["A", "B"])], "Answered", [["Neither, use C"]]));
    expect(bubble?.ownWords).toEqual(["Neither, use C"]);
    expect(bubble?.options.some((option) => option.isChosen)).toBe(false);
  });

  it("shows own words beside an option chosen in a multiple choice", () => {
    const [bubble] = bubblesOf(questionOf([choice("Which?", ["A", "B"], true)], "Answered", [["B", "and C"]]));
    expect(bubble?.ownWords).toEqual(["and C"]);
    expect(bubble?.options.filter((option) => option.isChosen).map((option) => option.label)).toEqual(["B"]);
  });

  it("says Skipped, with nothing chosen", () => {
    const [bubble] = bubblesOf(questionOf([choice("Which?", ["A", "B"])], "Skipped", null));
    expect(bubble).toMatchObject({ outcome: "Skipped", ownWords: [] });
    expect(bubble?.options.some((option) => option.isChosen)).toBe(false);
  });

  it("says Withdrawn when the thread was stopped", () => {
    const [bubble] = bubblesOf(questionOf([choice("Which?", ["A", "B"])], "Withdrawn", null));
    expect(bubble?.outcome).toBe("Withdrawn");
  });

  it("makes no bubble for an open question or an approval", () => {
    expect(bubblesOf(questionOf([choice("Which?", ["A"])], null, null))).toEqual([]);
    expect(bubblesOf(questionOf(null, "Allowed", null))).toEqual([]);
  });
});
