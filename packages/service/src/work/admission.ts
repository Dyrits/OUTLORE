import { Effect } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { invalid, readSettings, type ServiceFailure } from "../core/index.ts";
import { type Runner, type RunnerChoice, runnerOf } from "../harness/index.ts";
import { chooseThreadRunner } from "./handover.ts";
import { imageRefusalOf, readThreadRunner } from "./vision.ts";

// Admitting an owner's message (message-attachments): the text must say something unless files come with it, and a
// runner that cannot read images refuses a message that carries them, before anything is recorded. The runner that is
// judged is the one the request names, written once per kind of request here.

type Readable = Pick<Runner, "accountId" | "harness" | "model">;

/** An owner's text that says something. */
export const nonBlank = (text: string): Effect.Effect<string, ServiceFailure> =>
  text.trim().length === 0 ? invalid("The message is empty.") : Effect.succeed(text);

/** The runner of an existing thread, null when it is gone. */
export const runnerOfThread = (threadId: string) => readThreadRunner(threadId);

/** The runner a thread opened beneath its parent would have: the parent's, with the owner's choices on top. */
export const runnerOfOpened = (parentThreadId: string, choice: RunnerChoice) =>
  readThreadRunner(parentThreadId).pipe(
    Effect.map((parent) => (parent === null ? null : runnerOf({ ...parent, effort: "default" }, choice))),
  );

/** The runner a new quest would have: the default harness with the owner's choices on top. */
export const runnerOfStarted = (choice: RunnerChoice) =>
  readSettings.pipe(
    Effect.map((settings) =>
      runnerOf({ accountId: null, effort: "default", harness: settings.defaultHarness, model: "default" }, choice),
    ),
  );

/** Refuses attached images for a runner that cannot read them; a message without files is never refused. */
export const refuseUnreadableImages = Effect.fnUntraced(function* (
  attachmentIds: ReadonlyArray<string>,
  runner: Effect.Effect<Readable | null, SqlError.SqlError, SqlClient.SqlClient>,
) {
  if (attachmentIds.length === 0) return;
  const resolved = yield* runner;
  if (resolved === null) return;
  const reason = yield* imageRefusalOf(resolved);
  if (reason !== null) return yield* invalid(reason);
});

/** Admits an owner's text for the runner the request names: the text itself, or the refusal. */
export const admitOwnerText = Effect.fnUntraced(function* (
  text: string,
  attachmentIds: ReadonlyArray<string>,
  runner: Effect.Effect<Readable | null, SqlError.SqlError, SqlClient.SqlClient>,
) {
  const admitted = attachmentIds.length === 0 ? yield* nonBlank(text) : text;
  yield* refuseUnreadableImages(attachmentIds, runner);
  return admitted;
});

/** Admits a runner change only when that runner can read the thread's waiting images. */
export const admitRunnerChange = Effect.fnUntraced(function* (change: Parameters<typeof chooseThreadRunner>[0]) {
  const sql = yield* SqlClient.SqlClient;
  const waiting = yield* sql<{ id: string }>`SELECT a.id FROM attachments a JOIN messages m ON m.id = a.message_id
      WHERE m.thread_id = ${change.threadId} AND m.delivered_turn_id IS NULL AND m.sender_kind != 'agent' LIMIT 1`;
  yield* refuseUnreadableImages(
    waiting.map((row) => row.id),
    Effect.succeed(change),
  );
  return yield* chooseThreadRunner(change);
});
