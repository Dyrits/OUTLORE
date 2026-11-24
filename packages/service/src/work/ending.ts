import type { EndingPreview, MissionEnding, QuestPlacement } from "@outlore/contracts";
import { Clock, Effect, Layer, PubSub } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, dayMillis, hourMillis, invalid, notFound, readSettings, ServiceFailure } from "../core/index.ts";
import { Commands } from "./commands.ts";
import { eraseEmptyQuest } from "./deleting.ts";
import { emptyQuestCondition } from "./emptyQuest.ts";
import { changed, unchanged } from "./followUps.ts";
import { refuseGuildmaster } from "./guildmasterPlace.ts";
import { updateJournal } from "./journal.ts";
import { activeStates, haltThreads } from "./lifecycle.ts";
import { requireActiveQuestRealm } from "./realmAccess.ts";
import { timedSweep } from "./timedSweep.ts";

/** The journal entry for each way a mission ends or continues (mission-journal, When a mission ends). */
const journalEntries = {
  Archived: "Archived by the user",
  AutoArchived: "Archived automatically",
  Fulfilled: "Marked done by the user",
  Reopened: "Reopened by the user",
} as const;

const questionEndings = { Archived: "archive", Fulfilled: "mark as done" } satisfies Record<MissionEnding, string>;

/**
 * The confirmation naming the threads still at work. Threads in Attention count too, so no question stays open
 * on an ended mission (provisional: CHG-0045, work-in-progress Batch 9).
 */
const endingQuestionOf = (count: number, ending: MissionEnding) =>
  count === 1
    ? `1 thread is still running. Stop it and ${questionEndings[ending]}?`
    : `${count} threads are still running. Stop them and ${questionEndings[ending]}?`;

/** The ids of the quest's threads still working, which an ending must stop first. */
export const readWorkingIds = Effect.fn("readWorkingIds")(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [mission] = yield* sql<{ ending: MissionEnding | null }>`SELECT ending FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  yield* refuseGuildmaster(missionId, "ended or archived");
  const rows = yield* sql<{ id: string }>`SELECT id FROM threads
    WHERE mission_id = ${missionId} AND is_deleting = 0 AND state IN ${sql.in(activeStates)} ORDER BY id`;
  return rows.map((row) => row.id);
});

/** What ending the mission this way would stop. */
export const previewEnding = (missionId: string, ending: MissionEnding) =>
  readWorkingIds(missionId).pipe(
    Effect.map(
      (ids): EndingPreview => ({
        question: ids.length === 0 ? null : endingQuestionOf(ids.length, ending),
        snapshot: JSON.stringify(ids),
        workingCount: ids.length,
      }),
    ),
  );

/**
 * Whether archiving this mission should delete it instead: it used no tokens, holds no message, and is not a
 * Ritual's, so it carries nothing worth keeping (mission-tracking, Ending a mission).
 */
export const isEmptyQuest = Effect.fn("isEmptyQuest")(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{
    isEmpty: number;
  }>`SELECT ${sql.literal(emptyQuestCondition("m.id"))} AS isEmpty FROM missions m WHERE m.id = ${missionId}`;
  return row?.isEmpty === 1;
});

/** Records the ending and its journal entry. Callers run it in a transaction. */
const recordEnding = Effect.fnUntraced(function* (missionId: string, ending: MissionEnding, entry: string) {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  yield* sql`UPDATE missions SET ending = ${ending}, is_asking_done = 0,
      done_at = ${ending === "Fulfilled" ? now : sql`done_at`} WHERE id = ${missionId}`;
  yield* updateJournal(missionId, { kind: "user" }, entry, null);
});

/** Marks a mission Fulfilled or archives it, stopping exactly the threads at work the owner's preview named. */
export const endMission = Effect.fn("endMission")(function* (
  missionId: string,
  ending: MissionEnding,
  snapshot: string,
  source: "owner" | "Chronicler" | "auto-archive" | "realm archive" = "owner",
) {
  const sql = yield* SqlClient.SqlClient;
  const [mission] = yield* sql<{
    ending: MissionEnding | null;
  }>`SELECT ending FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  // An ended mission only moves from Fulfilled to Archived; anything else is reopened first.
  if (mission.ending !== null && !(mission.ending === "Fulfilled" && ending === "Archived"))
    return yield* invalid(
      mission.ending === "Fulfilled" ? "This mission is already done." : "Reopen this mission before marking it done.",
    );
  const ids = yield* readWorkingIds(missionId);
  if (JSON.stringify(ids) !== snapshot) {
    return yield* new ServiceFailure({
      kind: "StaleVersion",
      message: "The threads at work changed. Review them again before ending the quest.",
    });
  }
  const [parent] = yield* sql<
    QuestPlacement & { topThreadId: string }
  >`SELECT top.workspace_id AS workspaceId, w.name AS workspaceName,
    m.top_thread_id AS topThreadId
    FROM missions m JOIN threads top ON top.id = m.top_thread_id LEFT JOIN workspaces w ON w.id = top.workspace_id
    WHERE m.id = ${missionId}`;
  if (parent === undefined) return yield* notFound("No such quest.");
  const placement = { workspaceId: parent.workspaceId, workspaceName: parent.workspaceName };
  if (ending === "Archived" && source !== "realm archive" && (yield* isEmptyQuest(missionId))) {
    const deleted = yield* eraseEmptyQuest(parent.topThreadId);
    return changed(placement, deleted.followUps);
  }
  // Auto-archive never stops work: it only files a Fulfilled quest away, as before CHG-0304.
  const stopped = source === "auto-archive" ? [] : ids;
  yield* haltThreads(stopped, "Stopped");
  yield* recordEnding(
    missionId,
    ending,
    source === "auto-archive" ? journalEntries.AutoArchived : journalEntries[ending],
  );
  return changed(placement, { turnsToCancel: stopped });
});

/** Returns an ended mission to the state worked out from its threads. */
export const reopenMission = Effect.fn("reopenMission")(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [mission] = yield* sql<{ ending: string | null }>`SELECT ending FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  if (mission.ending === null) return yield* invalid("This mission has not ended.");
  yield* requireActiveQuestRealm(missionId);
  yield* sql`UPDATE missions SET ending = NULL WHERE id = ${missionId}`;
  yield* updateJournal(missionId, { kind: "user" }, journalEntries.Reopened, null);
  return changed(null);
});

/** Archives the Fulfilled missions past the auto-archive delay, when the setting is on. */
const archiveDueMissions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const settings = yield* readSettings;
  if (!settings.shouldAutoArchive) return unchanged(null);
  const now = yield* Clock.currentTimeMillis;
  const due = yield* sql<{ id: string }>`SELECT id FROM missions
    WHERE ending = 'Fulfilled' AND done_at IS NOT NULL AND done_at <= ${now - settings.autoArchiveDays * dayMillis}`;
  const missionsToRemoveScratch: string[] = [];
  const turnsToCancel: string[] = [];
  for (const { id } of due) {
    const ids = yield* readWorkingIds(id);
    const ended = yield* endMission(id, "Archived", JSON.stringify(ids), "auto-archive");
    missionsToRemoveScratch.push(...ended.followUps.missionsToRemoveScratch);
    turnsToCancel.push(...ended.followUps.turnsToCancel);
  }
  return due.length === 0 ? unchanged(null) : changed(null, { missionsToRemoveScratch, turnsToCancel });
});

/** Runs auto-archive at startup and whenever a Fulfilled quest is pending archive (provisional: CHG-0045, work-in-progress Batch 9). */
export const autoArchiveLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const commands = yield* Commands;
    const changes = yield* Changes;
    const sql = yield* SqlClient.SqlClient;
    const subscription = yield* PubSub.subscribe(changes.pubsub);
    const untilNextArchive = Effect.gen(function* () {
      const settings = yield* readSettings;
      if (!settings.shouldAutoArchive) return null;
      const [earliest] = yield* sql<{ doneAt: number | null }>`SELECT MIN(done_at) AS doneAt FROM missions
        WHERE ending = 'Fulfilled' AND done_at IS NOT NULL`;
      if (earliest?.doneAt == null) return dayMillis;
      const now = yield* Clock.currentTimeMillis;
      return Math.max(1, Math.min(earliest.doneAt + settings.autoArchiveDays * dayMillis - now, hourMillis));
    });
    yield* timedSweep({
      isWakeOnlyWhenIdle: true,
      name: "Auto-archive",
      untilNext: untilNextArchive,
      wakeOn: PubSub.take(subscription),
      work: commands.run(archiveDueMissions),
    });
  }),
);
