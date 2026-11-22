import {
  MissionId,
  type Ritual,
  type RitualCompanion,
  RitualCompanion as RitualCompanionSchema,
  RitualId,
  type RitualSchedule,
  type RitualScope,
  RitualScope as RitualScopeSchema,
  ThreadId,
} from "@outlore/contracts";
import { Cause, Clock, Effect, Exit, Layer, PubSub, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { Changes, hourMillis, invalid, newId, notFound } from "../core/index.ts";
import { refuseWaitingImages } from "./admission.ts";
import { Commands } from "./commands.ts";
import { deleteThread, previewDeletion } from "./deleting.ts";
import { changed, unchanged, type WithFollowUps } from "./followUps.ts";
import { changeThreadRunner } from "./handover.ts";
import { insertMessage } from "./messaging.ts";
import { insertQuest } from "./missions.ts";
import { nextRunAfter, runStateOf, scheduleOf } from "./ritualSchedule.ts";
import { insertThread } from "./tree.ts";

// Rituals (rituals): an instruction run on a schedule, or by hand; an entity of its realm beside the quests
// (CHG-0616). Its conversation — the mission's top thread — is the run history: each run leaves its trigger line
// there, then opens an errand beneath the Ritual, and its result line lands when the errand's turn ends. No thread
// ever takes a turn at the Ritual's top. A failed run falls back through its Ritual's Companion list (thread-handover).

/** The longest the scheduler sleeps, so a Ritual changed behind its back is still found within the hour. */
const longestSleepMillis = hourMillis;
/** How late a scheduled run may start: one that is later than this was missed while the service was down, and is skipped. */
const graceMillis = 5 * 60 * 1000;
/** The prefix of a scheduled run's trigger line; usage gaps recognise scheduled runs by it. */
export const scheduledRunPrefix = "Ritual · scheduled";

/** The states in which a Ritual's run errand is still at work, so another run would pile onto it. */
const busyStates = ["Underway", "Attention", "Waiting"] as const;

const decodeCompanion = Schema.decodeUnknownSync(RitualCompanionSchema);
const decodeFallbacks = Schema.decodeUnknownSync(Schema.Array(RitualCompanionSchema));
const decodeScope = Schema.decodeUnknownSync(RitualScopeSchema);

type RitualRow = {
  readonly authority: string;
  readonly createdAt: number;
  readonly fallbackStep: number;
  readonly fallbacks: string;
  readonly id: string;
  readonly instruction: string;
  readonly isOn: number;
  readonly isRealmArchived: number;
  /** Whether a run errand beneath the Ritual is still at work, so no other run may start. */
  readonly isRunUnderway: number;
  readonly lastRunAt: number | null;
  readonly lastRunState: string | null;
  readonly missionId: string;
  readonly nextRunAt: number | null;
  readonly originMissionId: string | null;
  readonly primaryCompanion: string;
  /** The state of the latest run errand, when one ran; how an unfinished run is read back. */
  readonly runThreadState: string | null;
  readonly schedule: string;
  readonly threadId: string;
  readonly title: string;
};

/**
 * The Rituals matching a condition: a Ritual's own identifiers, the mission that holds it, and where its current
 * run errand stands. The `runThreadId` condition matches the Ritual whose run errand the thread is.
 */
const readRows = Effect.fnUntraced(function* (
  condition: "all" | { readonly id: string } | { readonly missionId: string } | { readonly runThreadId: string },
) {
  const sql = yield* SqlClient.SqlClient;
  const where =
    condition === "all"
      ? sql`1 = 1`
      : "id" in condition
        ? sql`r.id = ${condition.id}`
        : "missionId" in condition
          ? sql`r.mission_id = ${condition.missionId}`
          : sql`r.mission_id = (SELECT mission_id FROM threads WHERE id = ${condition.runThreadId})
              AND m.top_thread_id = (SELECT parent_id FROM threads WHERE id = ${condition.runThreadId})`;
  return yield* sql<RitualRow>`
      SELECT r.id, r.mission_id AS missionId, m.top_thread_id AS threadId, m.title,
        r.authority, r.instruction, r.schedule, r.primary_companion AS primaryCompanion, r.fallbacks, r.is_on AS isOn,
        EXISTS (SELECT 1 FROM workspaces w WHERE w.id = t.workspace_id AND w.archived_at IS NOT NULL) AS isRealmArchived,
        r.next_run_at AS nextRunAt, r.last_run_at AS lastRunAt, r.last_run_state AS lastRunState,
        r.fallback_step AS fallbackStep, r.created_at AS createdAt, r.origin_mission_id AS originMissionId,
        EXISTS (SELECT 1 FROM threads e WHERE e.parent_id = m.top_thread_id AND e.is_deleting = 0
          AND e.state IN ${sql.in(busyStates)}) AS isRunUnderway,
        (SELECT e.state FROM threads e WHERE e.parent_id = m.top_thread_id AND e.is_deleting = 0
          AND e.is_aside = 0 ORDER BY e.rowid DESC LIMIT 1) AS runThreadState
      FROM rituals r JOIN missions m ON m.id = r.mission_id JOIN threads t ON t.id = m.top_thread_id
      WHERE ${where}`;
});

const ritualOf = (row: RitualRow): Ritual => ({
  fallbacks: decodeFallbacks(JSON.parse(row.fallbacks)),
  id: RitualId.make(row.id),
  instruction: row.instruction,
  isOn: row.isOn === 1,
  isRealmArchived: row.isRealmArchived === 1,
  lastRunAt: row.lastRunAt,
  lastRunState: runStateOf(row.lastRunState, row.runThreadState ?? "Resting"),
  missionId: MissionId.make(row.missionId),
  nextRunAt: row.nextRunAt,
  originMissionId: row.originMissionId === null ? null : MissionId.make(row.originMissionId),
  primary: decodeCompanion(JSON.parse(row.primaryCompanion)),
  schedule: scheduleOf(row.schedule),
  // Stored as `authority` (migration 0044): the owner's reviewed scope, empty by default.
  scope: decodeScope(JSON.parse(row.authority)),
  threadId: ThreadId.make(row.threadId),
  title: row.title,
});

/** The mission's Ritual, or null when the mission is not a Ritual's. */
export const readRitual = Effect.fnUntraced(function* (missionId: string) {
  const [row] = yield* readRows({ missionId });
  return row === undefined ? null : ritualOf(row);
});

/** Every Ritual, the latest first. */
export const listRituals = Effect.gen(function* () {
  const rows = yield* readRows("all");
  return rows.toSorted((current, next) => next.createdAt - current.createdAt).map(ritualOf);
});

/** What a Ritual's mission and its conversation thread are named. */
const renameMission = Effect.fnUntraced(function* (missionId: string, threadId: string, title: string) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE missions SET title = ${title}, is_title_by_user = 1 WHERE id = ${missionId}`;
  yield* sql`UPDATE threads SET title = ${title} WHERE id = ${threadId}`;
});

/** The realm and folder a Ritual made from a quest works in: the quest's own, wherever the quest is. */
const originRealmOf = Effect.fnUntraced(function* (originMissionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [origin] = yield* sql<{ realmId: string | null }>`
      SELECT t.workspace_id AS realmId FROM missions m JOIN threads t ON t.id = m.top_thread_id
      WHERE m.id = ${originMissionId} AND t.is_deleting = 0`;
  if (origin === undefined) return yield* notFound("No such quest.");
  return origin.realmId;
});

/**
 * Creates a Ritual and the mission that holds it. Nothing runs yet, nothing of the origin quest's comes along
 * beyond its realm, and nothing is written in the Ritual's conversation until its first run leaves its trigger.
 */
export const createRitual = Effect.fnUntraced(function* (input: {
  /** The owner's reviewed scope, already validated (ritualScope.ts); empty when left out. */
  readonly scope?: RitualScope;
  readonly fallbacks: ReadonlyArray<RitualCompanion>;
  readonly instruction: string;
  /** The quest the Ritual is made from, when there is one; its realm and folder to work in are then taken from it. */
  readonly originMissionId: string | null;
  readonly primary: RitualCompanion;
  readonly realm: { name: string } | null;
  /** The realm conversation that made the Ritual, when it has no origin quest. */
  readonly realmId?: string | null;
  readonly schedule: RitualSchedule;
  readonly title: string;
  readonly workspacePath: string | null;
}) {
  const sql = yield* SqlClient.SqlClient;
  const originRealmId = input.originMissionId === null ? undefined : yield* originRealmOf(input.originMissionId);
  const quest = yield* insertQuest(
    {
      firstMessage: null,
      isTitleByOwner: true,
      // An origin quest names the realm; folder and realm names matter only when there is none.
      realm: originRealmId === undefined ? input.realm : null,
      realmId: originRealmId === undefined ? (input.realmId ?? null) : originRealmId,
      shouldRememberChoices: false,
      title: input.title,
    },
    input.primary,
    originRealmId === undefined ? input.workspacePath : null,
  );
  const now = yield* Clock.currentTimeMillis;
  const ritualId = yield* newId;
  yield* sql`INSERT INTO rituals (id, mission_id, instruction, schedule, primary_companion, fallbacks, is_on,
        next_run_at, created_at, authority, origin_mission_id)
      VALUES (${ritualId}, ${quest.missionId}, ${input.instruction}, ${JSON.stringify(input.schedule)},
        ${JSON.stringify(input.primary)}, ${JSON.stringify(input.fallbacks)}, 1, ${nextRunAfter(input.schedule, now)},
        ${now}, ${JSON.stringify(input.scope ?? [])}, ${input.originMissionId})`;
  return changed({ missionId: quest.missionId, ritualId, threadId: quest.threadId });
});

/** Replaces a Ritual's fields; the next run is worked out again only when the schedule or the switch changed. */
export const updateRitual = Effect.fnUntraced(function* (input: {
  /** The owner's reviewed scope, already validated, replacing the current one; kept when left out. */
  readonly scope?: RitualScope;
  readonly fallbacks: ReadonlyArray<RitualCompanion>;
  readonly instruction: string;
  readonly isOn: boolean;
  readonly primary: RitualCompanion;
  readonly ritualId: string;
  readonly schedule: RitualSchedule;
  readonly title: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* readRows({ id: input.ritualId });
  if (row === undefined) return yield* notFound("No such Ritual.");
  if (input.isOn && row.isRealmArchived === 1)
    return yield* invalid("Restore this Ritual's archived realm before switching it on.");
  const now = yield* Clock.currentTimeMillis;
  const schedule = JSON.stringify(input.schedule);
  const isSameTiming = row.schedule === schedule && (row.isOn === 1) === input.isOn;
  const nextRunAt = input.isOn ? (isSameTiming ? row.nextRunAt : nextRunAfter(input.schedule, now)) : null;
  yield* sql`UPDATE rituals SET authority = ${input.scope === undefined ? row.authority : JSON.stringify(input.scope)}, instruction = ${input.instruction}, schedule = ${schedule},
      primary_companion = ${JSON.stringify(input.primary)}, fallbacks = ${JSON.stringify(input.fallbacks)},
      is_on = ${input.isOn ? 1 : 0}, next_run_at = ${nextRunAt} WHERE id = ${input.ritualId}`;
  yield* renameMission(row.missionId, row.threadId, input.title);
  return changed(null);
});

/**
 * Deletes the Ritual with everything it holds: its runs' errands, their reports, its conversation, journal, and
 * history, all permanently (CHG-0616). The service decides the whole tree in one step at this seam; the app's
 * single confirmation names what is lost.
 */
export const deleteRitual = Effect.fnUntraced(function* (ritualId: string) {
  const [row] = yield* readRows({ id: ritualId });
  if (row === undefined) return yield* notFound("No such Ritual.");
  const preview = yield* previewDeletion(row.threadId);
  return yield* deleteThread(row.threadId, preview.confirmation);
});

const clockOf = (millis: number) =>
  new Date(millis).toLocaleTimeString("en-GB", { hour: "2-digit", hour12: false, minute: "2-digit" });

/**
 * Starts a run: its trigger line lands in the Ritual's conversation, and the run itself opens an errand beneath the
 * Ritual, on the Ritual's primary Companion, with no backup list of its own; the returned wake runs it. The Ritual's
 * top thread is never woken — no thread takes a turn there. A manual run that would pile onto a run still
 * Underway is refused, and a scheduled one is skipped.
 */
const beginRun = Effect.fnUntraced(function* (
  row: RitualRow,
  trigger: { readonly kind: "manual" } | { readonly dueAt: number; readonly kind: "scheduled" },
) {
  const sql = yield* SqlClient.SqlClient;
  const isManual = trigger.kind === "manual";
  // One run at a time (CHG-0616): the Ritual waits for the run errand it opened; its own conversation thread gates
  // nothing and rests for good.
  if (row.isRunUnderway === 1) {
    if (isManual) return yield* invalid("This Ritual is still running. Wait for it to end or interrupt it.");
    return [];
  }
  const now = yield* Clock.currentTimeMillis;
  const label = isManual ? "Ritual · run by you" : `${scheduledRunPrefix} ${clockOf(trigger.dueAt)}`;
  // The trigger line stays in the conversation without waking it (conversation-only), and its marking keeps it from
  // ever counting as the owner's words or granting mention reach (CHG-0208).
  const { messageId: triggerId } = yield* insertMessage({
    fromThreadId: null,
    isConversationOnly: true,
    isQueued: false,
    isResult: false,
    text: label,
    threadId: row.threadId,
  });
  yield* sql`INSERT INTO ritual_run_messages (message_id, ritual_id) VALUES (${triggerId}, ${row.id})`;
  // The run errand: its opening request wears the trigger and carries the instruction.
  const opened = yield* insertThread({
    anchorMessageId: triggerId,
    // Empty on purpose: a failed run falls back through the Ritual's list, never an errand's own (thread-handover).
    backups: [],
    choice: decodeCompanion(JSON.parse(row.primaryCompanion)),
    isAside: false,
    isOpenedByAgent: false,
    isOwnCopyAsked: false,
    parentId: row.threadId,
    text: `${label}\n\n${row.instruction}`,
    title: label,
  });
  yield* sql`INSERT INTO ritual_run_messages (message_id, ritual_id) VALUES (${opened.messageId}, ${row.id})`;
  yield* sql`UPDATE rituals SET last_run_at = ${now}, last_run_state = 'Underway', fallback_step = 0 WHERE id = ${row.id}`;
  return [...opened.threadsToWake];
});

/** Runs a Ritual now, whatever its schedule and switch. */
export const runRitual = Effect.fnUntraced(function* (ritualId: string) {
  const [row] = yield* readRows({ id: ritualId });
  if (row === undefined) return yield* notFound("No such Ritual.");
  if (row.isRealmArchived === 1) return yield* invalid("Restore this Ritual's archived realm before running it.");
  const threadsToWake = yield* beginRun(row, { kind: "manual" });
  return changed(null, { threadsToWake });
});

/**
 * A scheduled run that could not start is not lost silently: the Ritual's conversation holds a line with the reason,
 * and the run reads as Failed with no errand (CHG-0616). The owner runs it again by hand, or the next scheduled run
 * starts as usual.
 */
const recordFailedStart = Effect.fnUntraced(function* (row: RitualRow, now: number, cause: Cause.Cause<unknown>) {
  const sql = yield* SqlClient.SqlClient;
  const failure = Cause.squash(cause);
  const reason = failure instanceof Error ? failure.message : String(failure);
  yield* sql`UPDATE rituals SET last_run_at = ${now}, last_run_state = 'Failed', fallback_step = 0 WHERE id = ${row.id}`;
  const { messageId } = yield* insertMessage({
    fromThreadId: null,
    isConversationOnly: true,
    isQueued: false,
    isResult: false,
    text: `Could not start the scheduled run: ${reason}`,
    threadId: row.threadId,
  });
  yield* sql`INSERT INTO ritual_run_messages (message_id, ritual_id) VALUES (${messageId}, ${row.id})`;
});

/**
 * Runs every Ritual that is on and due, and moves each to its next time. A run later than the grace was missed while the
 * service was down: it is skipped, not caught up.
 */
export const runDueRituals: Effect.Effect<WithFollowUps<null>, never, SqlClient.SqlClient> = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const now = yield* Clock.currentTimeMillis;
  const rows = (yield* readRows("all")).filter(
    (row) => row.isOn === 1 && row.nextRunAt !== null && row.nextRunAt <= now,
  );
  const toWake: Array<string> = [];
  for (const row of rows) {
    const dueAt = row.nextRunAt ?? now;
    yield* sql`UPDATE rituals SET next_run_at = ${nextRunAfter(scheduleOf(row.schedule), now)} WHERE id = ${row.id}`;
    if (now - dueAt > graceMillis) continue;
    // Its own savepoint, so a start that fails halfway leaves none of its writes behind.
    const started = yield* Effect.exit(sql.withTransaction(beginRun(row, { dueAt, kind: "scheduled" })));
    if (Exit.isSuccess(started)) {
      toWake.push(...started.value);
    } else yield* recordFailedStart(row, now, started.cause);
  }
  return rows.length === 0 ? unchanged(null) : changed(null, { threadsToWake: toWake });
}).pipe(Effect.orDie);

/**
 * A turn of a run errand ended: the run is Done, or Interrupted when the errand was stopped. The Ritual's
 * conversation gains the run's result line, which names the errand and how it ended. Any other thread's turns
 * change nothing.
 */
export const finishRitualRun = Effect.fnUntraced(function* (threadId: string, state: "Done" | "Interrupted") {
  const sql = yield* SqlClient.SqlClient;
  // The thread is a run errand only while it sits directly beneath its Ritual's conversation thread.
  const [run] = yield* sql<{ id: string; lastRunState: string | null; title: string; topThreadId: string }>`
      SELECT r.id, r.last_run_state AS lastRunState, e.title, m.top_thread_id AS topThreadId
      FROM threads e JOIN missions m ON m.id = e.mission_id AND m.top_thread_id = e.parent_id
      JOIN rituals r ON r.mission_id = m.id
      WHERE e.id = ${threadId}`;
  if (run === undefined || run.lastRunState !== "Underway") return;
  yield* sql`UPDATE rituals SET last_run_state = ${state} WHERE id = ${run.id}`;
  const { messageId } = yield* insertMessage({
    fromThreadId: null,
    isConversationOnly: true,
    isQueued: false,
    isResult: false,
    text: `Result from thread "${run.title}" (${threadId}): ${state}`,
    threadId: run.topThreadId,
  });
  yield* sql`INSERT INTO ritual_run_messages (message_id, ritual_id) VALUES (${messageId}, ${run.id})`;
});

/**
 * A turn of a run errand failed: the run carries on with the next Companion of the Ritual's list that differs from
 * the errand's, the conversation handed over to it (the line says why), or fails once the list is used up. Any
 * other thread's turns change nothing.
 */
export const fallBackAfterFailure = Effect.fnUntraced(function* (threadId: string, reason: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* readRows({ runThreadId: threadId });
  if (row === undefined || row.lastRunState !== "Underway") return unchanged(null);
  const fallbacks = decodeFallbacks(JSON.parse(row.fallbacks));
  for (let index = row.fallbackStep; index < fallbacks.length; index++) {
    const candidate = fallbacks[index];
    if (candidate === undefined) continue;
    const outcome = yield* Effect.exit(
      refuseWaitingImages(threadId, candidate).pipe(
        Effect.andThen(changeThreadRunner(threadId, candidate, { fellBackAfter: reason })),
      ),
    );
    // A Companion that cannot be taken, such as one on a removed account, or that is already the errand's, is passed over.
    if (!Exit.isSuccess(outcome) || !outcome.value.followUps.isChanged) continue;
    yield* sql`UPDATE rituals SET fallback_step = ${index + 1} WHERE id = ${row.id}`;
    return { followUps: outcome.value.followUps, value: null } satisfies WithFollowUps<null>;
  }
  yield* sql`UPDATE rituals SET last_run_state = 'Failed', fallback_step = ${fallbacks.length} WHERE id = ${row.id}`;
  return changed(null);
});

/**
 * The scheduler: runs the Rituals that are due, then sleeps until the next one is, waking early on any change, since a
 * Ritual may have been created or edited. It also marks runs the service lost by stopping as interrupted.
 */
export const ritualsLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const commands = yield* Commands;
    const changes = yield* Changes;
    yield* sql`UPDATE rituals SET last_run_state = 'Interrupted' WHERE last_run_state = 'Underway'`.pipe(Effect.orDie);
    const subscription = yield* PubSub.subscribe(changes.pubsub);
    const untilNextRun = Effect.gen(function* () {
      const now = yield* Clock.currentTimeMillis;
      const [next] = yield* sql<{ at: number | null }>`SELECT MIN(next_run_at) AS at FROM rituals
        WHERE is_on = 1 AND next_run_at IS NOT NULL`;
      return Math.max(1, Math.min((next?.at ?? now + longestSleepMillis) - now, longestSleepMillis));
    });
    const watch = Effect.gen(function* () {
      yield* commands.run(runDueRituals);
      const wait = yield* untilNextRun;
      yield* Effect.raceFirst(Effect.sleep(wait), PubSub.take(subscription));
    }).pipe(Effect.forever, Effect.orDie);
    yield* Effect.forkScoped(watch);
  }),
);
