import { Effect } from "effect";
import { SqlClient } from "effect/sql";

// Which quests, and which threads, the owner has. Every query that lists, looks up or acts on a quest asks this module
// what a quest is (its kind), where it stands (open, done, archived), and whether it is being deleted, as a fragment
// of its WHERE or as a reading function, so the stored flags behind those words (`missions.is_guildmaster`,
// `missions.ending`, `threads.is_deleting`, `threads.archived_at`) are read here and nowhere else, except as data a
// query returns (mission-tracking, Ending a mission; thread-tree, Deleting; CHG-0779).
//
// A quest is the row `m` of `missions`; its top thread is `top`, and the quest is being deleted when that thread is.
// A thread of any depth is `t`. Callers whose tables carry other names pass them.

/**
 * What a quest is for: the owner's own, Chronicler's own (permanent, one global and one per realm channel), or a
 * Companion's: the hidden one-thread quest in which a second model answers a message the owner mentioned it in
 * (`missions.is_companion`, CHG-0781). The owner's lists never hold the last two.
 */
export type QuestKind = "owner" | "chronicler" | "companion";

/** Where a quest stands: still going, marked done by the owner (`Fulfilled`), or archived. */
export type QuestStanding = "open" | "done" | "archived";

/** Every standing: all of a kind's quests, ended or not. */
export const everyStanding = ["open", "done", "archived"] as const satisfies ReadonlyArray<QuestStanding>;

/** Not archived: what the owner's lists and mentions offer. */
export const unarchivedStandings = ["open", "done"] as const satisfies ReadonlyArray<QuestStanding>;

/** Ended, by the owner's marking it done or by archiving. */
export const endedStandings = ["done", "archived"] as const satisfies ReadonlyArray<QuestStanding>;

/** The standing a stored `ending` means, for a query that returned it as data. */
export const standingOf = (ending: string | null): QuestStanding =>
  ending === null ? "open" : ending === "Archived" ? "archived" : "done";

/** What marks a quest of each kind, as SQL text: the one place a kind's storage is spelled. */
const kindConditions = {
  chronicler: (quest) => `${quest}.is_guildmaster = 1`,
  companion: (quest) => `${quest}.is_companion = 1`,
  // The owner's quest is every quest that is neither Chronicler's nor a Companion's, so the Companion's flag takes its
  // quests out of the owner's lists here and nowhere else.
  owner: (quest) => `${quest}.is_guildmaster = 0 AND ${quest}.is_companion = 0`,
} satisfies Record<QuestKind, (quest: string) => string>;

/** What marks a quest as standing each way, as SQL text. */
const standingConditions = {
  archived: (quest) => `${quest}.ending = 'Archived'`,
  done: (quest) => `${quest}.ending = 'Fulfilled'`,
  open: (quest) => `${quest}.ending IS NULL`,
} satisfies Record<QuestStanding, (quest: string) => string>;

/** Quest `m` is of the kind, as SQL text for a query built as a string; also a 1 or 0 column. */
export const questKindTextOf = (kind: QuestKind, quest = "m") => `(${kindConditions[kind](quest)})`;

/** Quest `m` stands in any of the standings, as SQL text; false for none. */
export const questStandingTextOf = (standings: ReadonlyArray<QuestStanding>, quest = "m") =>
  standings.length === 0 ? "0" : `(${standings.map((standing) => standingConditions[standing](quest)).join(" OR ")})`;

/** Whether quest `m` is of the kind. Also a column: 1 or 0 for a query that returns it as data. */
export const isQuestKindOf = (sql: SqlClient.SqlClient, kind: QuestKind, quest = "m") =>
  sql.literal(questKindTextOf(kind, quest));

/** Whether quest `m` stands in any of the standings. */
export const isQuestStandingOf = (sql: SqlClient.SqlClient, standings: ReadonlyArray<QuestStanding>, quest = "m") =>
  sql.literal(questStandingTextOf(standings, quest));

/** Whether a thread is not being deleted; given a quest's top thread, whether the quest is not being deleted. */
export const isNotBeingDeletedOf = (sql: SqlClient.SqlClient, thread = "t") => sql.literal(`${thread}.is_deleting = 0`);

/** Whether an errand's thread is archived (thread-tree, archiving an errand). Also a column: 1 or 0. */
export const isErrandArchivedOf = (sql: SqlClient.SqlClient, thread = "t") =>
  sql.literal(`(${thread}.archived_at IS NOT NULL)`);

/** Whether an errand's thread is not archived. */
export const isNotArchivedErrandOf = (sql: SqlClient.SqlClient, thread = "t") =>
  sql.literal(`${thread}.archived_at IS NULL`);

/** Whether a thread is not archived and not being deleted: an errand the owner can open. */
export const isErrandShownOf = (sql: SqlClient.SqlClient, thread = "t") =>
  sql`${isNotArchivedErrandOf(sql, thread)} AND ${isNotBeingDeletedOf(sql, thread)}`;

/** Where a query finds a quest and its top thread, for the fragments that need both. */
export type QuestAliases = { readonly quest?: string; readonly top?: string };

/**
 * The quests the owner can see in the standings: the owner's own, not being deleted, standing as asked. Quests of the
 * other kinds are never in an owner's list. Needs the quest `m` and its top thread `top` in the query.
 */
export const isVisibleQuestOf = (
  sql: SqlClient.SqlClient,
  standings: ReadonlyArray<QuestStanding> = everyStanding,
  { quest = "m", top = "top" }: QuestAliases = {},
) =>
  sql`${isQuestKindOf(sql, "owner", quest)} AND ${isNotBeingDeletedOf(sql, top)} AND ${isQuestStandingOf(sql, standings, quest)}`;

/** The quest `m`, joined to its top thread `top`, as a `FROM` for a query that asks about quests. */
export const questsFrom = (sql: SqlClient.SqlClient) => sql`missions m JOIN threads top ON top.id = m.top_thread_id`;

/** A quest's kind, from its row; null when there is no such quest. */
export const readQuestKind = Effect.fnUntraced(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const [row] = yield* sql<{ isChronicler: number; isCompanion: number }>`
    SELECT ${isQuestKindOf(sql, "chronicler")} AS isChronicler, ${isQuestKindOf(sql, "companion")} AS isCompanion
    FROM missions m WHERE m.id = ${missionId}`;
  if (row === undefined) return null;
  return row.isChronicler === 1
    ? ("chronicler" satisfies QuestKind)
    : row.isCompanion === 1
      ? ("companion" satisfies QuestKind)
      : ("owner" satisfies QuestKind);
});

/** Whether the thread belongs to a Companion's hidden quest. */
export const isCompanionThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
    SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id
    WHERE t.id = ${threadId} AND ${isQuestKindOf(sql, "companion")}`;
  return rows.length > 0;
});

/** Whether the quest is Chronicler's. */
export const isChroniclerQuest = Effect.fnUntraced(function* (missionId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
    SELECT m.id FROM missions m WHERE m.id = ${missionId} AND ${isQuestKindOf(sql, "chronicler")}`;
  return rows.length > 0;
});

/** Whether the thread belongs to Chronicler's quest. */
export const isChroniclerThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
    SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id
    WHERE t.id = ${threadId} AND ${isQuestKindOf(sql, "chronicler")}`;
  return rows.length > 0;
});

/** Whether the thread is Chronicler's top thread (its own quest's, not one of its errands). */
export const isChroniclerTopThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
    SELECT m.id FROM missions m WHERE m.top_thread_id = ${threadId} AND ${isQuestKindOf(sql, "chronicler")}`;
  return rows.length > 0;
});

/** Whether the thread belongs to a realm's or the Borderlands' Chronicler, rather than the global one. */
export const isChroniclerChannelThread = Effect.fnUntraced(function* (threadId: string) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
    SELECT t.id FROM threads t JOIN missions m ON m.id = t.mission_id
    WHERE t.id = ${threadId} AND ${isQuestKindOf(sql, "chronicler")} AND m.chronicler_channel IS NOT NULL`;
  return rows.length > 0;
});

/**
 * Chronicler's quest and top thread in one conversation: the global one for a null channel, a realm's for its id, the
 * Borderlands' for "borderlands". Null before it has been made.
 */
export const readChroniclerPlace = Effect.fnUntraced(function* (channel: string | null) {
  const sql = yield* SqlClient.SqlClient;
  const [place] = yield* sql<{ missionId: string; threadId: string }>`
    SELECT m.id AS missionId, m.top_thread_id AS threadId FROM missions m
    WHERE ${isQuestKindOf(sql, "chronicler")} AND m.chronicler_channel IS ${channel}`;
  return place ?? null;
});

/** Makes a quest Chronicler's own, for a conversation channel: null for the global one, a realm's id, or "borderlands". */
export const makeQuestChronicler = Effect.fnUntraced(function* (missionId: string, channel: string | null) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE missions SET is_guildmaster = 1, chronicler_channel = ${channel} WHERE id = ${missionId}`;
});

/** Whether the quest is one the owner can see, standing as given. */
export const isVisibleQuest = Effect.fnUntraced(function* (
  missionId: string,
  standings: ReadonlyArray<QuestStanding> = everyStanding,
) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{ id: string }>`
    SELECT m.id FROM ${questsFrom(sql)} WHERE m.id = ${missionId} AND ${isVisibleQuestOf(sql, standings)}`;
  return rows.length > 0;
});
