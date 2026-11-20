import { Effect, Layer, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { Changes } from "../core/index.ts";
import { Commands } from "./commands.ts";
import { changed, unchanged } from "./followUps.ts";
import { clip } from "./guildmasterText.ts";
import { readMissionSummaryMap } from "./matching.ts";
import { insertMessage } from "./messaging.ts";

// ----- Hearing back: the quests Chronicler opened tell it when they report, need the owner, or fail -----

/** The report a quest stands in, or null: a failure, Attention, or a result awaiting "Mark as done?", in that order. */
const reportOf = (summary: { readonly prompt: string | null; readonly state: string }) =>
  summary.state === "Failed"
    ? "Failed"
    : summary.state === "Attention"
      ? "Attention"
      : // Only once the turn that reported has ended, so its closing reply can be passed on.
        summary.prompt === "MarkDone" && summary.state !== "Underway" && summary.state !== "Waiting"
        ? "Reported"
        : null;

/** What Chronicler is told of one quest's report. */
const reportTextOf = (title: string, id: string, report: "Attention" | "Failed" | "Reported", detail: string) =>
  ({
    Attention: `Quest "${title}" (id ${id}) needs the owner: a thread there waits on a question or a decision. Tell the owner in a sentence, and that they answer it in that quest.${detail}`,
    Failed: `Quest "${title}" (id ${id}) failed.${detail} Tell the owner in a sentence.`,
    Reported: `Quest "${title}" (id ${id}) reported its result.${detail} Tell the owner in a sentence; do not repeat it all.`,
  })[report];

/**
 * Tells Chronicler, once, of each quest it opened that now reports, needs the owner, or failed, as a message from
 * that quest's top thread; a quest that no longer stands in a report is forgotten, so a later one is told again. It
 * changes nothing the owner sees when there is nothing to tell, so running it after every change cannot loop.
 */
export const reportToGuildmaster = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const opened = yield* sql<{ id: string; told: string | null; topThreadId: string; title: string }>`
    SELECT m.id, m.guildmaster_told AS told, m.top_thread_id AS topThreadId, m.title
    FROM missions m JOIN threads top ON top.id = m.top_thread_id
    WHERE m.opened_by_guildmaster = 1 AND top.is_deleting = 0`;
  if (opened.length === 0) return unchanged(null);
  const [guildmaster] = yield* sql<{ threadId: string }>`
    SELECT top_thread_id AS threadId FROM missions WHERE is_guildmaster = 1 AND chronicler_channel IS NULL`;
  if (guildmaster === undefined) return unchanged(null);
  const summaries = yield* readMissionSummaryMap(opened.map((quest) => quest.id));
  let isTold = false;
  for (const quest of opened) {
    const summary = summaries.get(quest.id);
    const report = summary === undefined ? null : reportOf(summary);
    if (report === quest.told) continue;
    yield* sql`UPDATE missions SET guildmaster_told = ${report} WHERE id = ${quest.id}`;
    if (report === null) continue;
    const [failure] =
      report === "Failed"
        ? yield* sql<{ failure: string | null }>`
            SELECT failure FROM threads WHERE mission_id = ${quest.id} AND state = 'Failed' LIMIT 1`
        : [];
    const [reply] =
      report === "Reported"
        ? yield* sql<{ text: string }>`
            SELECT text FROM messages WHERE thread_id = ${quest.topThreadId} AND sender_kind = 'agent'
            ORDER BY sequence DESC LIMIT 1`
        : [];
    const detail =
      failure?.failure != null
        ? ` Reason: ${clip(failure.failure, 400)}`
        : reply !== undefined
          ? ` Its last reply: ${clip(reply.text, 600)}`
          : "";
    yield* insertMessage({
      fromThreadId: quest.topThreadId,
      isQueued: false,
      isResult: false,
      text: reportTextOf(quest.title, quest.id, report, detail),
      threadId: guildmaster.threadId,
    });
    isTold = true;
  }
  return isTold ? changed(null, { threadsToWake: [guildmaster.threadId] }) : unchanged(null);
});

/**
 * Hearing back (quest coordination): after every committed change, tells Chronicler of each quest it opened that
 * now reports a result, needs the owner, or failed. A sweep with nothing to tell announces nothing, so it cannot loop.
 */
export const guildmasterReportsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const commands = yield* Commands;
    const changes = yield* Changes;
    const subscription = yield* PubSub.subscribe(changes.pubsub);
    const watch = PubSub.take(subscription).pipe(
      Effect.andThen(commands.run(reportToGuildmaster).pipe(Effect.ignore)),
      Effect.forever,
    );
    yield* Effect.forkScoped(watch);
  }),
);
