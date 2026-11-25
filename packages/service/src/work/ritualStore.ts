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
import { Clock, Effect, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, newId, nextRunAfter, notFound } from "../core/index.ts";
import { deleteThread, previewDeletion } from "./deleting.ts";
import { changed } from "./followUps.ts";
import { insertQuest } from "./missions.ts";
import { runStateOf, scheduleOf } from "./ritualSchedule.ts";

// The Rituals' stored side (rituals): reading a Ritual with where its run stands, and creating, updating, and deleting
// it. Starting its runs and the scheduler are in rituals.ts.

/** The states in which a Ritual's run errand is still at work, so another run would pile onto it. */
const busyStates = ["Underway", "Attention", "Waiting"] as const;

/** Decodes a stored Companion. */
export const decodeCompanion = Schema.decodeUnknownSync(RitualCompanionSchema);
/** Decodes a stored fallback list. */
export const decodeFallbacks = Schema.decodeUnknownSync(Schema.Array(RitualCompanionSchema));
const decodeScope = Schema.decodeUnknownSync(RitualScopeSchema);

/** A Ritual as the database holds it, with where its current run errand stands. */
export type RitualRow = {
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
export const readRows = Effect.fnUntraced(function* (
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
  const origin = input.originMissionId === null ? null : { realmId: yield* originRealmOf(input.originMissionId) };
  const quest = yield* insertQuest(
    {
      firstMessage: null,
      isTitleByOwner: true,
      // An origin quest names the realm; folder and realm names matter only when there is none.
      realm: origin === null ? input.realm : null,
      realmId: origin === null ? (input.realmId ?? null) : origin.realmId,
      shouldRememberChoices: false,
      title: input.title,
    },
    input.primary,
    origin === null ? input.workspacePath : null,
  );
  const now = yield* Clock.currentTimeMillis;
  const ritualId = yield* newId;
  yield* sql`INSERT INTO rituals (id, mission_id, instruction, schedule, primary_companion, fallbacks, is_on,
        next_run_at, created_at, authority, origin_mission_id)
      VALUES (${ritualId}, ${quest.missionId}, ${input.instruction}, ${JSON.stringify(input.schedule)},
        ${JSON.stringify(input.primary)}, ${JSON.stringify(input.fallbacks)}, 1, ${nextRunAfter(input.schedule, now)},
        ${now}, ${JSON.stringify(input.scope ?? [])}, ${input.originMissionId})`;
  // The wire result carries branded identifiers; the row layer above keeps plain strings.
  return changed({
    missionId: MissionId.make(quest.missionId),
    ritualId: RitualId.make(ritualId),
    threadId: ThreadId.make(quest.threadId),
  });
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
