import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId } from "@outlore/contracts";
import { Effect } from "effect";
import { claudeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { call, read, sendTo, settle, startMission, temporary } from "../fixtures/service.ts";

describe.runIf(process.env.OUTLORE_LIVE_CLAUDE === "1")("live Claude Code (uses a few tokens)", () => {
  it.live(
    "answers through the installed claude",
    () => {
      const directory = temporary("outlore-claude-");
      return Effect.gen(function* () {
        const started = yield* startMission({ effort: "low", model: "haiku", text: "Reply with exactly: ok" });
        const detail = yield* settle(started.missionId, (current) => current.thread.state !== "Underway");
        expect(detail.thread.failure).toBeNull();
        expect(detail.messages.at(-1)?.text.toLowerCase()).toContain("ok");
        expect(detail.mission.usage.output).toBeGreaterThan(0);
      }).pipe(
        Effect.provide(
          serviceLayer({
            filename: join(directory, "outlore.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.OUTLORE_CLAUDE_PATH ?? "claude",
              idleTimeout: "1 minute",
              sandboxProblem: null,
            }),
            homeFolder: directory,
            scratchRoot: join(directory, "missions"),
          }),
        ),
      );
    },
    120_000,
  );

  it.live(
    "runs an action outside the working folder only after an approval, recording each one",
    () => {
      const directory = temporary("outlore-claude-");
      const outside = join(directory, "outside", "approved.txt");
      const settleLong = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
        Effect.gen(function* () {
          for (let attempt = 0; attempt < 1200; attempt++) {
            const detail = yield* read(missionId);
            if (check(detail)) return detail;
            yield* Effect.sleep("100 millis");
          }
          return yield* Effect.die(new Error(`did not settle: ${JSON.stringify(yield* read(missionId))}`));
        });
      return Effect.gen(function* () {
        mkdirSync(join(directory, "outside"));
        const started = yield* startMission({
          effort: "low",
          model: "haiku",
          text: `Create the file ${outside} with the Bash command: touch ${outside}`,
        });
        // The model may ask through request_approval, or go straight to the command, whose escape from the sandbox
        // then asks (CHG-0031, CHG-0208); allow whatever opens until the turn ends.
        const isSettled = (current: MissionDetail) =>
          current.thread.state === "Resting" || current.thread.state === "Failed";
        let detail = yield* settleLong(
          started.missionId,
          (current) => isSettled(current) || current.thread.state === "Attention",
        );
        for (let round = 0; round < 3 && !isSettled(detail); round++) {
          const question = detail.questions.find((entry) => entry.outcome === null);
          expect(question?.details).toContain(outside);
          if (question === undefined) throw new Error("No open question");
          yield* call({
            _tag: "AnswerQuestion",
            answer: "Allow",
            message: null,
            questionId: question.id,
          });
          detail = yield* settleLong(
            started.missionId,
            (current) => isSettled(current) || current.thread.state === "Attention",
          );
        }
        expect(detail.thread.failure).toBeNull();
        expect(existsSync(outside)).toBe(true);
        expect(detail.questions.length, JSON.stringify(detail.questions)).toBeGreaterThan(0);
        expect(detail.questions.every((entry) => entry.outcome !== null)).toBe(true);
      }).pipe(
        Effect.provide(
          serviceLayer({
            filename: join(directory, "outlore.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.OUTLORE_CLAUDE_PATH ?? "claude",
              idleTimeout: "1 minute",
              sandboxProblem: null,
            }),
            homeFolder: directory,
            scratchRoot: join(directory, "missions"),
          }),
        ),
      );
    },
    180_000,
  );

  it.live(
    "opens a thread beneath that reports its result back to the opener",
    () => {
      const directory = temporary("outlore-claude-");
      return Effect.gen(function* () {
        const started = yield* startMission({
          effort: "low",
          model: "haiku",
          text: "Call open_thread once with the request: 'Compute 6 times 7, then call report_result with only the number as result and 'nothing to record' as journal.' Then end your turn. When the result arrives, reply with only that number.",
        });
        let detail = yield* read(started.missionId);
        for (let attempt = 0; attempt < 1200; attempt++) {
          detail = yield* read(started.missionId);
          const child = detail.threads.find((thread) => thread.parentId === started.threadId);
          const hasResult = detail.messages.some((message) => message.isResult);
          if (child?.state === "Fulfilled" && hasResult && detail.thread.state === "Resting") break;
          yield* Effect.sleep("100 millis");
        }
        const child = detail.threads.find((thread) => thread.parentId === started.threadId);
        expect(child).toMatchObject({ depth: 1, isOpenedByAgent: true, state: "Fulfilled" });
        expect(detail.messages.find((message) => message.isResult)?.text).toContain("42");
        expect(detail.messages.at(-1)).toMatchObject({ sender: "agent" });
        expect(detail.messages.at(-1)?.text).toContain("42");
      }).pipe(
        Effect.provide(
          serviceLayer({
            filename: join(directory, "outlore.sqlite"),
            harness: claudeHarnessLayer({
              command: process.env.OUTLORE_CLAUDE_PATH ?? "claude",
              idleTimeout: "1 minute",
              sandboxProblem: null,
            }),
            homeFolder: directory,
            scratchRoot: join(directory, "missions"),
          }),
        ),
      );
    },
    180_000,
  );

  const liveLayer = (directory: string) =>
    serviceLayer({
      filename: join(directory, "outlore.sqlite"),
      harness: claudeHarnessLayer({
        command: process.env.OUTLORE_CLAUDE_PATH ?? "claude",
        idleTimeout: "1 minute",
        sandboxProblem: null,
      }),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    });
  const settleLive = (missionId: MissionId, check: (detail: MissionDetail) => boolean) =>
    Effect.gen(function* () {
      for (let attempt = 0; attempt < 1200; attempt++) {
        const detail = yield* read(missionId);
        if (check(detail)) return detail;
        yield* Effect.sleep("100 millis");
      }
      return yield* Effect.die(new Error(`did not settle: ${JSON.stringify(yield* read(missionId))}`));
    });

  it.live(
    "takes a steered message into the running turn",
    () => {
      const directory = temporary("outlore-claude-");
      return Effect.gen(function* () {
        const started = yield* startMission({
          effort: "low",
          model: "haiku",
          text: "Run the bash command `sleep 8` exactly once, then reply with one short sentence.",
        });
        yield* settleLive(started.missionId, (detail) => detail.thread.state === "Underway");
        yield* Effect.sleep("4 seconds");
        const steered = yield* sendTo(started.threadId, "Also end your final answer with the word PINEAPPLE.", "Steer");
        const detail = yield* settleLive(
          started.missionId,
          (current) => current.thread.state === "Resting" || current.thread.state === "Failed",
        );
        expect(detail.thread.failure).toBeNull();
        expect(detail.messages.at(-1)?.text).toContain("PINEAPPLE");
        expect(detail.messages.find((message) => message.id === steered.messageId)?.isQueued).toBe(false);
        // Taken in by the first turn: the steered message comes before the turn's last reply.
        const replies = detail.messages.filter((message) => message.sender === "agent");
        expect(replies.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(liveLayer(directory)));
    },
    180_000,
  );

  it.live(
    "interrupts a running turn and keeps the thread usable",
    () => {
      const directory = temporary("outlore-claude-");
      return Effect.gen(function* () {
        const started = yield* startMission({
          effort: "low",
          model: "haiku",
          text: "Run this bash command exactly once in the foreground and wait for it: `for i in $(seq 1 60); do echo tick $i; sleep 1; done`. Then reply with: done.",
        });
        yield* settleLive(started.missionId, (detail) => detail.thread.state === "Underway");
        yield* Effect.sleep("5 seconds");
        const before = Date.now();
        yield* call({ _tag: "InterruptThread", threadId: started.threadId });
        const interrupted = yield* settleLive(started.missionId, (detail) => detail.thread.state !== "Underway");
        expect(Date.now() - before).toBeLessThan(15_000);
        expect(interrupted.thread).toMatchObject({ failure: null, state: "Resting" });

        yield* sendTo(started.threadId, "Reply with exactly: ok");
        const detail = yield* settleLive(
          started.missionId,
          (current) => current.thread.state === "Resting" && current.messages.at(-1)?.sender === "agent",
        );
        expect(detail.thread.failure).toBeNull();
        expect(detail.messages.at(-1)?.text.toLowerCase()).toContain("ok");
      }).pipe(Effect.provide(liveLayer(directory)));
    },
    180_000,
  );
});
