import { Choice, type Question } from "@outlore/contracts";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";

/** A stored row: the choices and answers are JSON text. */
type QuestionRow = Omit<Question, "answers" | "choices"> & {
  readonly answers: string | null;
  readonly choices: string | null;
};

const decodeChoices = Schema.decodeUnknownSync(Schema.NullOr(Schema.Array(Choice)));
const decodeAnswers = Schema.decodeUnknownSync(Schema.NullOr(Schema.Array(Schema.Array(Schema.String))));

const toQuestion = (row: QuestionRow): Question => ({
  ...row,
  answers: row.answers === null ? null : decodeAnswers(JSON.parse(row.answers)),
  choices: row.choices === null ? null : decodeChoices(JSON.parse(row.choices)),
});

// Every read joins the mission title, which a question shows outside its thread.
const selectQuestions = (sql: SqlClient.SqlClient) => sql`
  SELECT q.id, q.mission_id AS missionId, m.title AS missionTitle, q.thread_id AS threadId, q.source,
    q.summary, q.details, q.pattern, q.permission, q.asked_at AS askedAt, q.outcome, q.message, q.device,
    q.resolved_at AS resolvedAt, q.choices, q.answers
  FROM questions q JOIN missions m ON m.id = q.mission_id`;

/** A thread's questions, open and recorded, in the order asked. */
export const listThreadQuestions = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  return (yield* sql<QuestionRow>`${selectQuestions(sql)} WHERE q.thread_id = ${threadId} ORDER BY q.asked_at, q.rowid`).map(
    toQuestion,
  );
});

/** Every open question across missions, oldest first, for the dashboard's list. */
export const listOpenQuestions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  return (yield* sql<QuestionRow>`${selectQuestions(sql)} WHERE q.outcome IS NULL ORDER BY q.asked_at, q.rowid`).map(
    toQuestion,
  );
});

/** Recorded questions, newest first, optionally for one mission. */
export const listQuestionHistory = Effect.fnUntraced(function* (missionId: string | null) {
  const sql = yield* SqlClient.SqlClient;
  return (yield* sql<QuestionRow>`${selectQuestions(sql)}
    WHERE q.outcome IS NOT NULL AND ${missionId === null ? sql`1 = 1` : sql`q.mission_id = ${missionId}`}
    ORDER BY q.resolved_at DESC, q.rowid DESC`).map(toQuestion);
});

/** One question by its identifier. */
export const readQuestion = Effect.fnUntraced(function* (questionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [question] = yield* sql<QuestionRow>`${selectQuestions(sql)} WHERE q.id = ${questionId}`;
  return question === undefined ? null : toQuestion(question);
});
