import type { Choice } from "@outlore/contracts";
import { messageOf } from "../foundation/client";
import { answersOfDrafts, type ChoiceDraft } from "./questionAnswers";

/** The actions a choice card offers for its current drafts, including failures for its error line. */
export function choiceActions(
  choices: ReadonlyArray<Choice>,
  drafts: ReadonlyArray<ChoiceDraft>,
  request: (answers: ReadonlyArray<ReadonlyArray<string>> | null) => Promise<unknown>,
  showError: (error: string | null) => void,
) {
  const answers = answersOfDrafts(choices, drafts);
  const submit = (given: ReadonlyArray<ReadonlyArray<string>> | null) =>
    request(given).then(
      () => showError(null),
      (reason) => showError(messageOf(reason)),
    );
  return {
    isSendDisabled: answers === null,
    send: () => (answers === null ? Promise.resolve() : submit(answers)),
    skip: () => submit(null),
  };
}
