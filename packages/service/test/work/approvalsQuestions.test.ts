import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer, Option } from "effect";
import { Approvals } from "../../src/work/index.ts";
import {
  answer,
  ask,
  call,
  databaseFile,
  failureOf,
  isAsking,
  isReplied,
  lastReply,
  live,
  openQuestion,
  push,
  read,
  serviceOn,
  settle,
  start,
} from "../fixtures/approvals.ts";

describe("asking before an action the thread judges consequential", () => {
  it.live("puts the thread in Attention with one open question, listed for the dashboard", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      const detail = yield* settle(started.missionId, isAsking);

      expect(detail.thread.state).toBe("Attention");
      expect(detail.mission.state).toBe("Attention");
      expect(detail.questions).toHaveLength(1);
      expect(openQuestion(detail)).toMatchObject({
        details: "git push origin main",
        pattern: "git push origin main",
        permission: "Run this exact command",
        source: "Thread",
        summary: push.action,
      });
      const open = yield* call({ _tag: "ListOpenQuestions" });
      expect(open.map((question) => [question.missionTitle, question.threadId, question.threadTitle])).toEqual([
        [detail.mission.title, started.threadId, detail.thread.title],
      ]);
    }).pipe(Effect.provide(live())),
  );

  it.live("names no kind from the command's words, and the escape capability only when asked for", () =>
    Effect.gen(function* () {
      const labelled = yield* start(
        ask({ action: "Rotate the staging token", command: "./rotate-token.sh staging", permission: "Rotate tokens" }),
      );
      expect(openQuestion(yield* settle(labelled.missionId, isAsking)).permission).toBe("Run this exact command");

      const leaving = yield* start(ask({ ...push, outsideSandbox: true }));
      expect(openQuestion(yield* settle(leaving.missionId, isAsking))).toMatchObject({
        details: "git push origin main",
        permission: "Run outside the sandbox",
        summary: `${push.action}. Run this exact command outside the sandbox.`,
      });
    }).pipe(Effect.provide(live())),
  );

  it.live("asks one question per action, never bundled", () =>
    Effect.gen(function* () {
      const started = yield* start(`${ask(push)}\n${ask({ ...push, command: "git push origin release" })}`);
      const first = yield* settle(started.missionId, isAsking);
      expect(first.questions).toHaveLength(1);
      yield* answer(openQuestion(first), "Allow");
      const second = yield* settle(started.missionId, (detail) => detail.questions.length === 2 && isAsking(detail));
      expect(openQuestion(second).details).toBe("git push origin release");
    }).pipe(Effect.provide(live())),
  );

  it.live("tells the thread Allowed, records the answer, and returns the thread to work", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      const asking = yield* settle(started.missionId, isAsking);
      const answered = yield* answer(openQuestion(asking), "Allow");
      expect(answered).toMatchObject({ device: "host window", outcome: "Allowed" });

      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("Allowed.");
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("passes the owner's message on Deny with a message", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny", "Open a pull request instead");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("Denied by the owner: Open a pull request instead");
      expect(detail.questions[0]).toMatchObject({ message: "Open a pull request instead", outcome: "Denied" });
    }).pipe(Effect.provide(live())),
  );

  it.live("tells the thread the action was not approved on Deny without a message", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* answer(openQuestion(yield* settle(started.missionId, isAsking)), "Deny");
      const detail = yield* settle(started.missionId, isReplied);
      expect(lastReply(detail)).toContain("Not approved by the owner");
      expect(detail.questions.map((question) => question.outcome)).toEqual(["Denied"]);
    }).pipe(Effect.provide(live())),
  );

  it.live("refuses a second answer to the same question", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      const question = openQuestion(yield* settle(started.missionId, isAsking));
      yield* answer(question, "Allow");
      const failure = yield* failureOf({
        _tag: "AnswerQuestion",
        answer: "Deny",
        message: null,
        questionId: question.id,
      });
      expect(failure.kind).toBe("InvalidInput");
    }).pipe(Effect.provide(live())),
  );
});

describe("no grant from prose", () => {
  it.live("asks even when the owner's message names the action and the thread quotes it", () =>
    Effect.gen(function* () {
      const started = yield* start(`Looks good, push it.\n${ask({ ...push, quote: "push it" })}`);
      const detail = yield* settle(started.missionId, (current) => isAsking(current) || isReplied(current));
      expect(detail.questions[0]).toMatchObject({ details: push.command, outcome: null });
      yield* answer(openQuestion(detail), "Allow");
      expect(lastReply(yield* settle(started.missionId, isReplied))).toContain("Allowed.");
    }).pipe(Effect.provide(live())),
  );

  it.live("never lets a quote spare the question for a sandbox escape either", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `Run it outside the sandbox.\n${ask({ ...push, outsideSandbox: true, quote: "Run it outside the sandbox" })}`,
      );
      const detail = yield* settle(started.missionId, (current) => isAsking(current) || isReplied(current));
      expect(detail.questions[0]).toMatchObject({ outcome: null, permission: "Run outside the sandbox" });
    }).pipe(Effect.provide(live())),
  );
});

describe("withdrawing questions", () => {
  const escapeInput = { command: "git push origin feature", dangerouslyDisableSandbox: true };

  it.live("Stop withdraws the open question and marks the thread Stopped", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const detail = yield* read(started.missionId);
      expect(detail.thread.state).toBe("Stopped");
      expect(detail.questions[0]?.outcome).toBe("Withdrawn");
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
    }).pipe(Effect.provide(live())),
  );

  it.live("allows nothing for a prompt that arrives after Stop, while the harness is still exiting", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      yield* call({ _tag: "StopThread", threadId: started.threadId });
      const approvals = yield* Approvals;
      for (const input of [escapeInput, { command: "ls" }]) {
        const late = yield* approvals
          .answerPrompt(started.threadId, { input, toolName: "Bash" })
          .pipe(Effect.timeoutOption("1 second"));
        expect(Option.getOrThrow(late).isAllowed).toBe(false);
      }
      expect(yield* call({ _tag: "ListOpenQuestions" })).toEqual([]);
      expect((yield* read(started.missionId)).thread.state).toBe("Stopped");
    }).pipe(Effect.provide(live())),
  );

  it.live("withdraws a question whose caller gave up waiting", () =>
    Effect.gen(function* () {
      const started = yield* start(ask(push));
      yield* settle(started.missionId, isAsking);
      const approvals = yield* Approvals;
      const call = yield* approvals
        .answerPrompt(started.threadId, { input: escapeInput, toolName: "Bash" })
        .pipe(Effect.forkChild);
      yield* settle(started.missionId, (detail) => detail.questions.length === 2);
      yield* Fiber.interrupt(call);
      const detail = yield* read(started.missionId);
      expect(detail.questions.map((question) => question.outcome)).toEqual([null, "Withdrawn"]);
      expect(detail.thread.state).toBe("Attention");
    }).pipe(Effect.provide(live())),
  );

  it.live("withdraws questions left open by a restart and leaves their thread Idle", () =>
    Effect.gen(function* () {
      const filename = databaseFile();
      const started = yield* Effect.scoped(
        Effect.gen(function* () {
          const context = yield* Layer.build(serviceOn(filename));
          return yield* Effect.gen(function* () {
            const started = yield* start(ask(push));
            yield* settle(started.missionId, isAsking);
            return started;
          }).pipe(Effect.provideContext(context));
        }),
      );
      const detail = yield* read(started.missionId).pipe(Effect.provide(serviceOn(filename)));
      expect(detail.thread.state).toBe("Resting");
      expect(detail.questions[0]?.outcome).toBe("Withdrawn");
    }),
  );
});
