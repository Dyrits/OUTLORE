import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import {
  endedStandings,
  everyStanding,
  isChroniclerChannelThread,
  isChroniclerQuest,
  isChroniclerThread,
  isChroniclerTopThread,
  isErrandArchivedOf,
  isErrandShownOf,
  isNotArchivedErrandOf,
  isNotBeingDeletedOf,
  isQuestKindOf,
  isQuestStandingOf,
  isVisibleQuest,
  isVisibleQuestOf,
  makeQuestChronicler,
  type QuestStanding,
  questKindTextOf,
  questStandingTextOf,
  questsFrom,
  readChroniclerPlace,
  readQuestKind,
  standingOf,
  unarchivedStandings,
} from "../../src/work/questVisibility.ts";
import { guildmaster } from "../fixtures/guildmaster.ts";
import { fixture, open, start } from "../fixtures/service.ts";

// Which quests and errands the owner has (CHG-0779): every kind of quest in every standing, and a quest or errand being
// deleted, asked through the module's fragments and readers.

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** The owner's quests in each standing, one being deleted, and Chronicler's own, with each errand's thread beneath. */
const world = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const opened = yield* start("Open quest");
  const done = yield* start("Done quest");
  const archived = yield* start("Archived quest");
  const deleting = yield* start("Deleting quest");
  const chronicler = yield* guildmaster;
  yield* sql`UPDATE missions SET ending = 'Fulfilled' WHERE id = ${done.missionId}`;
  yield* sql`UPDATE missions SET ending = 'Archived' WHERE id = ${archived.missionId}`;
  yield* sql`UPDATE threads SET is_deleting = 1 WHERE id = ${deleting.threadId}`;
  const shownErrand = yield* open(opened.threadId, "Shown errand");
  const archivedErrand = yield* open(opened.threadId, "Archived errand");
  const deletingErrand = yield* open(opened.threadId, "Deleting errand");
  yield* sql`UPDATE threads SET archived_at = 1 WHERE id = ${archivedErrand.threadId}`;
  yield* sql`UPDATE threads SET is_deleting = 1 WHERE id = ${deletingErrand.threadId}`;
  // Chronicler has a conversation for each place the owner has opened, so more than one quest is Chronicler's.
  const chroniclers = (yield* sql<{ id: string }>`SELECT id FROM missions WHERE is_guildmaster = 1`).map(
    (row) => row.id,
  );
  return { archived, archivedErrand, chronicler, chroniclers, deleting, deletingErrand, done, opened, shownErrand };
});

/** The ids of the quests a condition picks out of every quest, with their top threads. */
const questsWhere = (condition: (sql: SqlClient.SqlClient) => unknown) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT m.id FROM ${questsFrom(sql)} WHERE ${condition(sql)} ORDER BY m.id`;
    return rows.map((row) => row.id).sort();
  });

/** The ids of the threads a condition picks out of every thread. */
const threadsWhere = (condition: (sql: SqlClient.SqlClient) => unknown) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql<{ id: string }>`SELECT t.id FROM threads t WHERE ${condition(sql)}`;
    return rows.map((row) => row.id).sort();
  });

const sorted = (...ids: ReadonlyArray<string>) => [...ids].sort();

describe("telling a quest's kind", () => {
  it.live("picks the owner's quests, being deleted or not, with the owner kind", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* questsWhere((sql) => isQuestKindOf(sql, "owner"))).toEqual(
        sorted(quests.opened.missionId, quests.done.missionId, quests.archived.missionId, quests.deleting.missionId),
      );
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("picks Chronicler's quest with the chronicler kind and no owner quest", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* questsWhere((sql) => isQuestKindOf(sql, "chronicler"))).toEqual(sorted(...quests.chroniclers));
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("picks no quest with the reserved companion kind, and leaves it out of the owner's", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* questsWhere((sql) => isQuestKindOf(sql, "companion"))).toEqual([]);
      // Every quest is of one kind: the owner's and Chronicler's together are all of them.
      const owner = yield* questsWhere((sql) => isQuestKindOf(sql, "owner"));
      const chronicler = yield* questsWhere((sql) => isQuestKindOf(sql, "chronicler"));
      expect([...owner, ...chronicler].sort()).toEqual(
        sorted(
          quests.opened.missionId,
          quests.done.missionId,
          quests.archived.missionId,
          quests.deleting.missionId,
          ...quests.chroniclers,
        ),
      );
    }).pipe(Effect.provide(setup().layer)),
  );

  it("gives the same condition as text for a query built as a string", () => {
    expect(questKindTextOf("chronicler")).toBe("(m.is_guildmaster = 1)");
    expect(questKindTextOf("companion")).toBe("(0)");
    expect(questKindTextOf("owner", "mi")).toBe("(mi.is_guildmaster = 0 AND NOT (0))");
  });

  it.live("reads a quest's kind, and null for none", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* readQuestKind(quests.opened.missionId)).toBe("owner");
      expect(yield* readQuestKind(quests.chronicler.missionId)).toBe("chronicler");
      expect(yield* readQuestKind("no-such-quest")).toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("telling where a quest stands", () => {
  it.live("picks each standing alone", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      const standing = (one: QuestStanding) => questsWhere((sql) => isQuestStandingOf(sql, [one]));
      // Chronicler's quest is open too: the standing alone says nothing of the kind.
      expect(yield* standing("open")).toEqual(
        sorted(quests.opened.missionId, quests.deleting.missionId, ...quests.chroniclers),
      );
      expect(yield* standing("done")).toEqual([quests.done.missionId]);
      expect(yield* standing("archived")).toEqual([quests.archived.missionId]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("picks the unarchived, the ended and every standing by the standings they name", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      const standing = (standings: ReadonlyArray<QuestStanding>) =>
        questsWhere((sql) => isQuestStandingOf(sql, standings));
      expect(yield* standing(unarchivedStandings)).toEqual(
        sorted(quests.opened.missionId, quests.done.missionId, quests.deleting.missionId, ...quests.chroniclers),
      );
      expect(yield* standing(endedStandings)).toEqual(sorted(quests.done.missionId, quests.archived.missionId));
      expect((yield* standing(everyStanding)).length).toBe(4 + quests.chroniclers.length);
      expect(yield* standing([])).toEqual([]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it("gives the same condition as text, false for no standing", () => {
    expect(questStandingTextOf(["open", "done"], "mi")).toBe("(mi.ending IS NULL OR mi.ending = 'Fulfilled')");
    expect(questStandingTextOf(["archived"])).toBe("(m.ending = 'Archived')");
    expect(questStandingTextOf([])).toBe("0");
  });

  it("names the standing a stored ending means", () => {
    expect(standingOf(null)).toBe("open");
    expect(standingOf("Fulfilled")).toBe("done");
    expect(standingOf("Archived")).toBe("archived");
  });
});

describe("listing the quests the owner can see", () => {
  it.live("lists the owner's quests in every standing, leaving out Chronicler's and the one being deleted", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* questsWhere((sql) => isVisibleQuestOf(sql))).toEqual(
        sorted(quests.opened.missionId, quests.done.missionId, quests.archived.missionId),
      );
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("lists only the standings asked for", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* questsWhere((sql) => isVisibleQuestOf(sql, ["open"]))).toEqual([quests.opened.missionId]);
      expect(yield* questsWhere((sql) => isVisibleQuestOf(sql, ["done"]))).toEqual([quests.done.missionId]);
      expect(yield* questsWhere((sql) => isVisibleQuestOf(sql, ["archived"]))).toEqual([quests.archived.missionId]);
      expect(yield* questsWhere((sql) => isVisibleQuestOf(sql, unarchivedStandings))).toEqual(
        sorted(quests.opened.missionId, quests.done.missionId),
      );
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("tells whether one quest is visible, for each kind, standing and deletion", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* isVisibleQuest(quests.opened.missionId)).toBe(true);
      expect(yield* isVisibleQuest(quests.opened.missionId, ["done", "archived"])).toBe(false);
      expect(yield* isVisibleQuest(quests.archived.missionId, endedStandings)).toBe(true);
      expect(yield* isVisibleQuest(quests.deleting.missionId)).toBe(false);
      expect(yield* isVisibleQuest(quests.chronicler.missionId)).toBe(false);
      expect(yield* isVisibleQuest("no-such-quest")).toBe(false);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("lets a quest being deleted come back when its deletion is undone", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const quests = yield* world;
      yield* sql`UPDATE threads SET is_deleting = 0 WHERE id = ${quests.deleting.threadId}`;
      expect(yield* isVisibleQuest(quests.deleting.missionId)).toBe(true);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("finds a quest's top thread under another name when the query calls it so", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const quests = yield* world;
      const rows = yield* sql<{ id: string }>`
        SELECT q.id FROM missions q JOIN threads head ON head.id = q.top_thread_id
        WHERE ${isVisibleQuestOf(sql, ["open"], { quest: "q", top: "head" })}`;
      expect(rows.map((row) => row.id)).toEqual([quests.opened.missionId]);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("listing the threads the owner can see", () => {
  it.live("leaves out a thread being deleted", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      const ids = yield* threadsWhere((sql) => isNotBeingDeletedOf(sql));
      expect(ids).toContain(quests.shownErrand.threadId);
      expect(ids).toContain(quests.archivedErrand.threadId);
      expect(ids).not.toContain(quests.deletingErrand.threadId);
      expect(ids).not.toContain(quests.deleting.threadId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("tells an archived errand from one that is not", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* threadsWhere((sql) => isErrandArchivedOf(sql))).toEqual([quests.archivedErrand.threadId]);
      const notArchived = yield* threadsWhere((sql) => isNotArchivedErrandOf(sql));
      expect(notArchived).toContain(quests.shownErrand.threadId);
      expect(notArchived).toContain(quests.deletingErrand.threadId);
      expect(notArchived).not.toContain(quests.archivedErrand.threadId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("shows an errand that is neither archived nor being deleted", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      const ids = yield* threadsWhere((sql) => isErrandShownOf(sql));
      expect(ids).toContain(quests.shownErrand.threadId);
      expect(ids).not.toContain(quests.archivedErrand.threadId);
      expect(ids).not.toContain(quests.deletingErrand.threadId);
      expect(ids).not.toContain(quests.deleting.threadId);
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("finding Chronicler's own quest", () => {
  it.live("tells its quest, its top thread and its threads from the owner's", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* isChroniclerQuest(quests.chronicler.missionId)).toBe(true);
      expect(yield* isChroniclerQuest(quests.opened.missionId)).toBe(false);
      expect(yield* isChroniclerThread(quests.chronicler.threadId)).toBe(true);
      expect(yield* isChroniclerThread(quests.opened.threadId)).toBe(false);
      expect(yield* isChroniclerTopThread(quests.chronicler.threadId)).toBe(true);
      expect(yield* isChroniclerTopThread(quests.shownErrand.threadId)).toBe(false);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("reads the global conversation's place, and none for a channel that was not opened", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      expect(yield* readChroniclerPlace(null)).toEqual({
        missionId: quests.chronicler.missionId,
        threadId: quests.chronicler.threadId,
      });
      expect(yield* readChroniclerPlace("a-realm")).toBeNull();
      expect(yield* isChroniclerChannelThread(quests.chronicler.threadId)).toBe(false);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("makes a quest Chronicler's for a channel, which then reads as a channel thread", () =>
    Effect.gen(function* () {
      const quests = yield* world;
      yield* makeQuestChronicler(quests.opened.missionId, "a-realm");
      expect(yield* readQuestKind(quests.opened.missionId)).toBe("chronicler");
      expect(yield* readChroniclerPlace("a-realm")).toEqual({
        missionId: quests.opened.missionId,
        threadId: quests.opened.threadId,
      });
      expect(yield* isChroniclerChannelThread(quests.opened.threadId)).toBe(true);
      expect(yield* isVisibleQuest(quests.opened.missionId)).toBe(false);
    }).pipe(Effect.provide(setup().layer)),
  );
});
