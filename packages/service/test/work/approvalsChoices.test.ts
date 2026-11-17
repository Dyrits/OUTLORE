import { describe, expect, it } from "@effect/vitest";
import type { Question } from "@outlore/contracts";
import { Effect } from "effect";
import {
  ask,
  call,
  failureOf,
  isAsking,
  isReplied,
  lastReply,
  live,
  openQuestion,
  push,
  read,
  settle,
  start,
} from "../fixtures/approvals.ts";

describe("asking the owner to choose (AskUserQuestion)", () => {
  const build = {
    header: "Build",
    multiple: false,
    options: [
      { description: "x", label: "A" },
      { description: "y", label: "B" },
    ],
    question: "Which build?",
  };
  const targets = {
    header: "Targets",
    multiple: true,
    options: [
      { description: "x", label: "Mac" },
      { description: "y", label: "Web" },
      { description: "z", label: "Phone" },
    ],
    question: "Which targets?",
  };
  const asking = (...questions: ReadonlyArray<{ readonly multiple: boolean }>) =>
    `call answer_prompt ${JSON.stringify({
      input: { questions: questions.map(({ multiple, ...rest }) => ({ ...rest, multiSelect: multiple })) },
      tool_name: "AskUserQuestion",
    })}`;
  const choose = (question: Question, answers: ReadonlyArray<ReadonlyArray<string>> | null) =>
    call({ _tag: "AnswerChoices", answers, questionId: question.id });

  it.live("holds the turn in Attention on a choice question, never running it unasked", () =>
    Effect.gen(function* () {
      const started = yield* start(asking(build, targets));
      const detail = yield* settle(started.missionId, isAsking);

      expect(detail.thread.state).toBe("Attention");
      expect(detail.questions).toHaveLength(1);
      expect(openQuestion(detail)).toMatchObject({
        choices: [
          { allowsOther: true, ...build },
          { allowsOther: true, ...targets },
        ],
        outcome: null,
        pattern: null,
        permission: null,
        source: "Harness",
      });
      expect(yield* call({ _tag: "ListOpenQuestions" })).toHaveLength(1);
    }).pipe(Effect.provide(live())),
  );

  it.live("returns the answers to Claude Code through updatedInput.answers, joining a multiple choice", () =>
    Effect.gen(function* () {
      const started = yield* start(asking(build, targets));
      const open = openQuestion(yield* settle(started.missionId, isAsking));
      const answered = yield* choose(open, [["B"], ["Mac", "Phone"]]);
      const detail = yield* settle(started.missionId, isReplied);

      expect(answered).toMatchObject({ answers: [["B"], ["Mac", "Phone"]], outcome: "Answered" });
      expect(detail.questions.map((question) => question.outcome)).toEqual(["Answered"]);
      const reply = lastReply(detail);
      expect(reply).toContain('"behavior":"allow"');
      expect(reply).toContain('"answers":{"Which build?":"B","Which targets?":"Mac, Phone"}');
      expect(reply).toContain('"multiSelect":true');
    }).pipe(Effect.provide(live())),
  );

  it.live("gives an adapter that asks through askOwner the answers too, not only Allow", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `prompt AskUserQuestion ${JSON.stringify({ questions: [{ ...build, multiSelect: false }] })}`,
      );
      yield* choose(openQuestion(yield* settle(started.missionId, isAsking)), [["A"]]);
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain('prompt answered: [["A"]]');
    }).pipe(Effect.provide(live())),
  );

  it.live("carries a typed Other answer as the answer's text", () =>
    Effect.gen(function* () {
      const started = yield* start(asking(build));
      const open = openQuestion(yield* settle(started.missionId, isAsking));
      yield* choose(open, [["Neither, use C"]]);
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain(
        '"answers":{"Which build?":"Neither, use C"}',
      );
    }).pipe(Effect.provide(live())),
  );

  it.live("tells the thread the owner skipped, and records it apart from a withdrawal", () =>
    Effect.gen(function* () {
      const started = yield* start(asking(build));
      const open = openQuestion(yield* settle(started.missionId, isAsking));
      expect(yield* choose(open, null)).toMatchObject({ answers: null, outcome: "Skipped" });
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain('"behavior":"deny"');
      expect(lastReply(detail)).toContain("skipped");
      expect(detail.thread.state).toBe("Idle");
    }).pipe(Effect.provide(live())),
  );

  it.live("withdraws the choice when the thread is stopped", () =>
    Effect.gen(function* () {
      const started = yield* start(asking(build));
      yield* settle(started.missionId, isAsking);
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const detail = yield* read(started.missionId);
      expect(detail.questions[0]?.outcome).toBe("Withdrawn");
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses answers that do not fit the questions, and keeps the question open", () =>
    Effect.gen(function* () {
      const started = yield* start(asking(build, targets));
      const open = openQuestion(yield* settle(started.missionId, isAsking));
      for (const wrong of [[["A"]], [["A", "B"], ["Mac"]], [["A"], []], [[" "], ["Mac"]]])
        yield* failureOf({ _tag: "AnswerChoices", answers: wrong, questionId: open.id });
      expect(isAsking(yield* read(started.missionId))).toBe(true);
    }).pipe(Effect.provide(live())),
  );

  it.live("keeps the two kinds of question apart: Allow cannot answer a choice, choices cannot answer an action", () =>
    Effect.gen(function* () {
      const choice = yield* start(asking(build));
      const choiceOpen = openQuestion(yield* settle(choice.missionId, isAsking));
      yield* failureOf({ _tag: "AnswerQuestion", answer: "Allow", message: null, questionId: choiceOpen.id });

      const action = yield* start(ask(push));
      const actionOpen = openQuestion(yield* settle(action.missionId, isAsking));
      yield* failureOf({ _tag: "AnswerChoices", answers: [["A"]], questionId: actionOpen.id });
      expect(isAsking(yield* read(action.missionId))).toBe(true);
    }).pipe(Effect.provide(live())),
  );
});
