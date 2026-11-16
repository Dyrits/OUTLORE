import type { Choice } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { choiceActions } from "../../src/ui/choiceCard";
import { emptyDraft, pickOption } from "../../src/ui/questionAnswers";

const choice: Choice = {
  allowsOther: false,
  header: "",
  multiple: false,
  options: [{ description: "", label: "A" }],
  question: "Which?",
};

describe("answering a choice card", () => {
  it("blocks Send until the choice has an answer and sends the selected answer", async () => {
    const sent: Array<ReadonlyArray<ReadonlyArray<string>> | null> = [];
    const request = async (answers: ReadonlyArray<ReadonlyArray<string>> | null) => {
      sent.push(answers);
    };
    const blocked = choiceActions([choice], [emptyDraft], request, () => {});
    expect(blocked.isSendDisabled).toBe(true);
    await blocked.send();
    expect(sent).toEqual([]);
    const ready = choiceActions([choice], [pickOption(choice, emptyDraft, "A")], request, () => {});
    expect(ready.isSendDisabled).toBe(false);
    await ready.send();
    expect(sent).toEqual([[["A"]]]);
  });

  it("sends null on Skip and gives the card the failure to display", async () => {
    const sent: Array<ReadonlyArray<ReadonlyArray<string>> | null> = [];
    const errors: Array<string | null> = [];
    const actions = choiceActions(
      [choice],
      [emptyDraft],
      async (answers) => {
        sent.push(answers);
        throw new Error("Could not answer");
      },
      (error) => errors.push(error),
    );
    await actions.skip();
    expect(sent).toEqual([null]);
    expect(errors).toEqual(["Could not answer"]);
  });
});
