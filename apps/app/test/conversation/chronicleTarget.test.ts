import { MessageId, MissionId, type Question, QuestionId, ThreadId } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { targetIndexOf } from "../../src/conversation/chronicleTarget";
import type { Entry } from "../../src/conversation/entries";

const threadId = ThreadId.make("thread");
const question = (id: string, at: number, outcome: Question["outcome"]): Entry => ({
  _tag: "Question",
  at,
  key: id,
  question: {
    answers: null,
    askedAt: at,
    choices: null,
    details: id,
    device: null,
    id: QuestionId.make(id),
    message: null,
    missionId: MissionId.make("mission"),
    missionTitle: "Mission",
    outcome,
    pattern: null,
    permission: null,
    resolvedAt: outcome === null ? null : at,
    source: "Harness",
    summary: id,
    threadId,
    threadTitle: "Thread",
  },
});

describe("opening a Chronicle target", () => {
  it("finds the newest unanswered request even when later requests are settled", () => {
    const entries = [
      question("old", 1, null),
      question("new", 2, null),
      question("settled", 3, "AllowedAutomatically"),
    ];
    expect(
      targetIndexOf(entries, { messageId: null, questionId: QuestionId.make("new"), threadId, waitingAt: null }),
    ).toBe(1);
  });
  it("resolves simultaneous requests consistently and reports a missing target", () => {
    const entries = [question("a", 2, null), question("b", 2, null)];
    expect(
      targetIndexOf(entries, { messageId: null, questionId: QuestionId.make("a"), threadId, waitingAt: null }),
    ).toBe(1);
    expect(
      targetIndexOf(entries, { messageId: MessageId.make("absent"), questionId: null, threadId, waitingAt: null }),
    ).toBe(-1);
    expect(
      targetIndexOf([question("newer", 3, null)], {
        messageId: null,
        questionId: QuestionId.make("old"),
        threadId,
        waitingAt: null,
      }),
    ).toBe(-1);
  });
});
