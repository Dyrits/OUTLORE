import { describe, expect, it } from "@effect/vitest";
import { type Request, WorkspaceId } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { advance, claude, codex, create, readRitual, replies, runErrandOf, withService } from "../fixtures/rituals.ts";
import { call, read, start, temporary } from "../fixtures/service.ts";

// A Ritual's schedule and editing (CHG-0616): a Ritual is an entity of its realm instead of a quest of its own,
// so its runs are errands beneath it and its conversation holds only the run history. The realm's lists keep
// the quests apart from the rituals until they ask to include them.

// The realm's mission list, plain (without the realm's Rituals) or with them drawn as ritual rows (CHG-0616).
const listMissions = (workspaceId: string | null, includeRituals: boolean | "omit") => {
  const request: Extract<Request, { _tag: "ListMissions" }> = {
    _tag: "ListMissions",
    isArchived: false,
    search: null,
    state: null,
    workspaceId: workspaceId === null ? null : WorkspaceId.make(workspaceId),
    ...(includeRituals === "omit" ? {} : { includeRituals }),
  };
  return call(request);
};

const hasScheduledLine = (detail: { messages: ReadonlyArray<{ text: string }> }) =>
  detail.messages.some((message) => message.text.startsWith("Ritual · scheduled"));

describe("the schedule", () => {
  it.effect("runs a due Ritual on its own errand, and only a Ritual that is on", () =>
    withService(
      Effect.gen(function* () {
        const hourly = { _tag: "Hourly", hours: 1 } as const;
        const on = yield* create("runner", { schedule: hourly, title: "On" });
        const off = yield* create("runner", { schedule: hourly, title: "Off" });
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [],
          instruction: "runner",
          isOn: false,
          primary: claude,
          ritualId: off.ritualId,
          schedule: hourly,
          title: "Off",
        });
        yield* advance(30 * 60 * 1000);
        expect(replies(yield* read(on.missionId))).toEqual([]);
        yield* advance(31 * 60 * 1000);
        for (let index = 0; index < 5; index++) yield* advance(40);
        const detail = yield* read(on.missionId);
        // The Ritual's conversation holds the run's trigger line, and the run itself is an errand beneath it.
        expect(detail.messages[0]?.text).toMatch(/^Ritual · scheduled /);
        const errand = runErrandOf(detail);
        expect(errand).not.toBeNull();
        if (errand === null) return yield* Effect.die("No errand");
        const errandDetail = yield* read(on.missionId, errand.id);
        expect(replies(errandDetail)).toEqual(["Echo: claude/claude-sonnet-5-5/default/session none"]);
        yield* advance(20 * 60 * 1000);
        expect((yield* read(on.missionId)).messages).toHaveLength(2);
        expect((yield* readRitual(on.missionId))?.lastRunAt).not.toBeNull();

        const offDetail = yield* read(off.missionId);
        expect(offDetail.messages).toEqual([]);
        expect(runErrandOf(offDetail)).toBeNull();
        expect((yield* readRitual(off.missionId))?.lastRunAt).toBeNull();

        yield* call({ _tag: "RunRitual", ritualId: off.ritualId });
        const manual = yield* read(off.missionId);
        expect(manual.messages[0]?.text).toBe("Ritual · run by you");
        expect(runErrandOf(manual)).not.toBeNull();
        expect(yield* readRitual(off.missionId)).toMatchObject({ isOn: false, nextRunAt: null });
      }),
    ),
  );

  it.effect("skips a run missed while the app was closed and moves to the next one", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner", { schedule: { _tag: "Hourly", hours: 1 } });
        const sql = yield* SqlClient.SqlClient;
        // The service was down for a day: the run due then is long past.
        yield* sql`UPDATE rituals SET next_run_at = -86400000`;
        // Any change wakes the scheduler, which then finds the run long past.
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [],
          instruction: "runner",
          isOn: true,
          primary: claude,
          ritualId: created.ritualId,
          schedule: { _tag: "Hourly", hours: 1 },
          title: "Morning digest",
        });
        yield* advance(1000);
        const ritual = yield* readRitual(created.missionId);
        expect(ritual?.lastRunAt).toBeNull();
        expect(ritual?.nextRunAt).toBeGreaterThan(0);
        const detail = yield* read(created.missionId);
        expect(detail.messages).toEqual([]);
        expect(runErrandOf(detail)).toBeNull();
      }),
    ),
  );

  it.effect("skips a scheduled run while its predecessor errand is still at work, and says nothing", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner", { schedule: { _tag: "Hourly", hours: 1 } });
        const sql = yield* SqlClient.SqlClient;
        yield* advance(65 * 60 * 1000);
        for (let index = 0; index < 5; index++) yield* advance(40);
        expect(hasScheduledLine(yield* read(created.missionId))).toBe(true);
        // The predecessor's errand is still at work when the next run comes due: a stand-in for one in a turn.
        yield* sql`UPDATE threads SET state = 'Underway' WHERE parent_id = ${created.threadId}`;
        yield* advance(60 * 60 * 1000);
        const detail = yield* read(created.missionId);
        expect(detail.messages.filter((message) => message.text.startsWith("Ritual · scheduled"))).toHaveLength(1);
        const ritual = yield* readRitual(created.missionId);
        expect(ritual?.lastRunAt).not.toBeNull();
        // The Ritual moved past the skipped time either way, so its next run is the one after it.
        expect(ritual?.nextRunAt).toBeGreaterThan(120 * 60 * 1000);
      }),
    ),
  );

  it.effect("holds a scheduled run at a reached budget and runs its errand once the budget is raised", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner", { schedule: { _tag: "Hourly", hours: 1 } });
        const spender = yield* start("spend 100");
        for (let index = 0; index < 5; index++) yield* advance(20);
        expect((yield* read(spender.missionId)).mission.budget.spent.tokens).toBe(100);
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* call({
          _tag: "UpdateSettings",
          settings: { ...settings, globalBudget: { cost: null, tokens: 100 } },
        });

        yield* advance(65 * 60 * 1000);
        for (let index = 0; index < 5; index++) yield* advance(40);
        const held = yield* read(created.missionId);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Underway");
        expect(held.messages[0]?.text).toMatch(/^Ritual · scheduled /);
        const errand = runErrandOf(held);
        if (errand === null) return yield* Effect.die("No errand");
        const heldErrand = yield* read(created.missionId, errand.id);
        expect(heldErrand.thread).toMatchObject({ blocker: "Budget", state: "Attention" });
        expect(replies(heldErrand)).toEqual([]);

        yield* call({
          _tag: "UpdateSettings",
          settings: { ...settings, globalBudget: { cost: null, tokens: 200 } },
        });
        for (let index = 0; index < 5; index++) yield* advance(40);
        const released = yield* read(created.missionId, errand.id);
        expect(replies(released)).toEqual(["Echo: claude/claude-sonnet-5-5/default/session none"]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );
});

describe("where a Ritual lives", () => {
  it.live("takes its realm from the quest it was made from, and refuses an origin quest that does not exist", () =>
    withService(
      Effect.gen(function* () {
        const folder = yield* Effect.sync(() => temporary("origin-realm-"));
        const quest = yield* start("The plan", folder);
        const created = yield* create("runner", { originMissionId: quest.missionId });
        const questDetail = yield* read(quest.missionId);
        const detail = yield* read(created.missionId);
        expect(detail.mission.workspaceId).toBe(questDetail.mission.workspaceId);
        expect((yield* readRitual(created.missionId))?.originMissionId).toBe(quest.missionId);

        // It is a ritual row of the origin quest's realm, and the plain quest lists stay without it.
        const plain = yield* listMissions(detail.mission.workspaceId, "omit");
        expect(plain.missions.map((mission) => mission.id)).not.toContain(created.missionId);
        const withRituals = yield* listMissions(detail.mission.workspaceId, true);
        const row = withRituals.missions.find((mission) => mission.id === created.missionId);
        expect(row?.ritual).toMatchObject({
          isOn: true,
          originMissionId: quest.missionId,
          schedule: { _tag: "Daily", time: "07:00" },
        });

        const refused = yield* create("runner", { originMissionId: "no-such-quest" }).pipe(Effect.flip);
        expect(refused.kind).toBe("NotFound");
        expect(refused.message).toBe("No such quest.");
      }),
    ),
  );
});

describe("editing and deleting a Ritual", () => {
  it.live("recomputes the next run from a new schedule, and none while it is off", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const update = (isOn: boolean) =>
          call({
            _tag: "UpdateRitual",
            fallbacks: [codex],
            instruction: "new instruction",
            isOn,
            primary: claude,
            ritualId: created.ritualId,
            schedule: { _tag: "Hourly", hours: 2 },
            title: "Renamed",
          });
        yield* update(true);
        const edited = yield* readRitual(created.missionId);
        expect(edited).toMatchObject({ fallbacks: [codex], instruction: "new instruction", title: "Renamed" });
        expect(edited?.nextRunAt).toBeGreaterThan(Date.now() + 90 * 60 * 1000);
        expect((yield* read(created.missionId)).thread.title).toBe("Renamed");
        yield* update(false);
        expect((yield* readRitual(created.missionId))?.nextRunAt).toBeNull();
      }),
    ),
  );

  it.live("deletes the Ritual with its runs, their errands, and the whole history", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        yield* call({ _tag: "RunRitual", ritualId: created.ritualId });
        yield* Effect.sleep("1 seconds");
        yield* call({ _tag: "DeleteRitual", ritualId: created.ritualId });
        expect(yield* readRitual(created.missionId)).toBeNull();
        const failed = yield* read(created.missionId).pipe(Effect.flip);
        expect(failed.kind).toBe("NotFound");
        expect(yield* call({ _tag: "ListRituals" })).toEqual([]);
        const { missions } = yield* listMissions(null, true);
        expect(missions.map((mission) => mission.id)).not.toContain(created.missionId);
      }),
    ),
  );
});
