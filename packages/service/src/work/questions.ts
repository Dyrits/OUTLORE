import type { Answer, Choice, QuestionOutcome, QuestionSource } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { type Changes, invalid, notFound } from "../core/index.ts";
import { answersProblemOf, insertPermission, readQuestion } from "../policy/index.ts";
import { makeOwnerWaits } from "./attention.ts";
import { resumeInTurn } from "./lifecycle.ts";

/** The kind carries exactly the data needed to answer and remember a question. */
export type Asked = {
  readonly details: string;
  readonly missionId: string;
  readonly source: QuestionSource;
  readonly summary: string;
  readonly threadId: string;
} & (
  | { readonly kind: "Approval"; readonly pattern: string; readonly permission: string }
  | { readonly kind: "Confirmation" }
  | { readonly kind: "Choice"; readonly choices: ReadonlyArray<Choice> }
);

type QuestionAnswer =
  | { readonly kind: "Action"; readonly answer: Answer; readonly message: string | null }
  | { readonly kind: "Choice"; readonly answers: ReadonlyArray<ReadonlyArray<string>> | null };

/** The outcome persisted for a question and delivered to its waiting caller. */
export interface Resolution {
  readonly answers?: ReadonlyArray<ReadonlyArray<string>> | null;
  readonly message: string | null;
  readonly outcome: QuestionOutcome;
}

const outcomeOfAnswer = {
  Allow: "Allowed",
  AlwaysAllow: "AlwaysAllowed",
  Deny: "Denied",
} as const satisfies Record<Answer, QuestionOutcome>;

/** Outcomes that permit an action, never a choice answer. */
export const allowingOutcomes: ReadonlyArray<QuestionOutcome> = [
  "Allowed",
  "AlwaysAllowed",
  "AllowedByMessage",
  "AllowedByPermission",
  "AllowedAutomatically",
];

// Shown to the thread after an approval. The approved command must run alone: anything chained to it no longer
// matches and asks again. An ordinary approval keeps the sandbox; only an escape the owner allowed leaves it.
const allowedText =
  "Allowed. Do exactly this action now, with nothing chained before or after it; run any other step separately. " +
  "Keep the command's sandbox protection; this answer does not grant an escape.";

const skippedText =
  "The owner skipped this question and chose not to answer. Carry on without an answer, or ask again in plain text if you still need one.";

/** The outcome in words for the thread, preserving refusals, skips and withdrawal. */
export const textOf = (resolution: Resolution, outsideSandbox = false) =>
  resolution.outcome === "Skipped"
    ? skippedText
    : allowingOutcomes.includes(resolution.outcome)
      ? outsideSandbox
        ? "Allowed. Run exactly this command outside the sandbox once, with nothing added."
        : allowedText
      : resolution.outcome === "Withdrawn"
        ? "Withdrawn: the owner stopped this thread."
        : resolution.message !== null
          ? `Denied by the owner: ${resolution.message}`
          : "Not approved by the owner. Do not do this action; carry on without it.";

/** The single store and owner-wait lifecycle for approvals, confirmations and choices. */
export const makeQuestions = (
  sql: SqlClient.SqlClient,
  changes: Changes["Service"],
  forgetAllowances: (threadId: string) => void,
) => {
  const waits = makeOwnerWaits<Resolution>(sql, changes);
  const withdrawn: Resolution = { message: null, outcome: "Withdrawn" };
  /** Records a question already decided without asking, as a line in its thread. */
  const record = (asked: Asked, resolution: Resolution) =>
    sql.withTransaction(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        yield* sql`INSERT INTO questions (id, mission_id, thread_id, source, summary, details, pattern, permission,
              kind, asked_at, outcome, message, resolved_at)
            VALUES (${crypto.randomUUID()}, ${asked.missionId}, ${asked.threadId}, ${asked.source}, ${asked.summary},
              ${asked.details}, ${asked.kind === "Approval" ? asked.pattern : null}, ${asked.kind === "Approval" ? asked.permission : null}, ${asked.kind}, ${now}, ${resolution.outcome},
              ${resolution.message}, ${now})`;
        yield* sql.afterCommit(changes.publish);
      }),
    );

  /**
   * Opens a question, puts its thread in Attention, and waits with no time limit for its resolution.
   * A thread no longer at work, such as one just stopped whose harness is still exiting, is not asked.
   */
  const ask = (asked: Asked) =>
    waits
      .ask({
        // A caller that gave up, such as Claude Code abandoning the call, leaves nobody to answer.
        abandon: (id) => resolve(id, asked.threadId, withdrawn, null),
        missionId: asked.missionId,
        record: (id, now) =>
          sql`INSERT INTO questions (id, mission_id, thread_id, source, summary, details, pattern, permission,
                kind, asked_at, choices)
              VALUES (${id}, ${asked.missionId}, ${asked.threadId}, ${asked.source}, ${asked.summary},
                ${asked.details}, ${asked.kind === "Approval" ? asked.pattern : null}, ${asked.kind === "Approval" ? asked.permission : null}, ${asked.kind}, ${now},
                ${asked.kind === "Choice" ? JSON.stringify(asked.choices) : null})`.pipe(Effect.asVoid),
        threadId: asked.threadId,
      })
      .pipe(Effect.map((resolution) => resolution ?? withdrawn));

  /** Ends an open question and returns its thread to Underway once no other question is open. */
  const resolve = (questionId: string, threadId: string, resolution: Resolution, device: string | null) =>
    sql.withTransaction(
      Effect.gen(function* () {
        const now = yield* Clock.currentTimeMillis;
        yield* sql`UPDATE questions SET outcome = ${resolution.outcome}, message = ${resolution.message},
              answers = ${resolution.answers === undefined || resolution.answers === null ? null : JSON.stringify(resolution.answers)},
              device = ${device}, resolved_at = ${now}
            WHERE id = ${questionId} AND outcome IS NULL`;
        yield* resumeInTurn(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
        yield* sql.afterCommit(changes.publish);
      }),
    );

  const answerQuestion = (questionId: string, given: QuestionAnswer, device: string) =>
    Effect.gen(function* () {
      const question = yield* readQuestion(questionId);
      if (question === null) return yield* notFound("No such question.");
      if (question.outcome !== null) return yield* invalid("This question was already answered.");
      if (!waits.isWaiting(questionId)) return yield* invalid("This question is no longer waiting.");
      const [stored] = yield* sql<{ kind: string }>`SELECT kind FROM questions WHERE id = ${questionId}`;
      const kind = stored?.kind;
      let resolution: Resolution;
      if (given.kind === "Choice") {
        if (kind !== "Choice" || question.choices === null)
          return yield* invalid("This question asks for Allow or Deny, not choices.");
        const problem = given.answers === null ? null : answersProblemOf(question.choices, given.answers);
        if (problem !== null) return yield* invalid(problem);
        const answers = given.answers === null ? null : given.answers.map((texts) => texts.map((text) => text.trim()));
        resolution = { answers, message: null, outcome: answers === null ? "Skipped" : "Answered" };
      } else {
        if (kind === "Choice") return yield* invalid("This question asks you to choose: answer its choices.");
        const note =
          given.answer === "Deny" && given.message !== null && given.message.trim() !== ""
            ? given.message.trim()
            : null;
        resolution = { message: note, outcome: outcomeOfAnswer[given.answer] };
        if (given.answer === "AlwaysAllow") {
          if (kind !== "Approval" || question.pattern === null || question.permission === null)
            return yield* invalid("This action needs a one-time confirmation. Choose Allow or Deny.");
          yield* sql.withTransaction(insertPermission(question.threadId, question.permission, question.pattern.trim()));
        }
      }
      yield* resolve(questionId, question.threadId, resolution, device);
      yield* waits.settle(questionId, resolution);
      return (yield* readQuestion(questionId)) ?? question;
    }).pipe(Effect.provideService(SqlClient.SqlClient, sql));

  const answer = (id: string, answer: Answer, message: string | null, device: string) =>
    answerQuestion(id, { answer, kind: "Action", message }, device);
  const answerChoices = (id: string, answers: ReadonlyArray<ReadonlyArray<string>> | null, device: string) =>
    answerQuestion(id, { answers, kind: "Choice" }, device);

  const withdraw = (threadId: string) =>
    Effect.gen(function* () {
      const open = yield* sql<{
        id: string;
      }>`SELECT id FROM questions WHERE thread_id = ${threadId} AND outcome IS NULL`;
      for (const { id } of open) {
        yield* resolve(id, threadId, withdrawn, null);
        yield* waits.settle(id, withdrawn);
      }
      forgetAllowances(threadId);
    }).pipe(Effect.orDie);

  return { answer, answerChoices, ask, record, withdraw };
};
