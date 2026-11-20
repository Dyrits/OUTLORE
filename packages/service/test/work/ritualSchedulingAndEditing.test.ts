import { describe, expect, it } from "@effect/vitest";
import type { RitualSchedule } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { advance, claude, codex, create, readRitual, replies, withService } from "../fixtures/rituals.ts";
import { call, read, start } from "../fixtures/service.ts";

describe("the schedule", () => {
  it.effect("holds a scheduled run at a reached budget and runs its waiting message when the budget is raised", () =>
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

        yield* advance(70 * 60 * 1000);
        for (let index = 0; index < 5; index++) yield* advance(20);
        const held = yield* read(created.missionId);
        expect(held.thread).toMatchObject({ blocker: "Budget", state: "Attention" });
        expect(held.messages).toHaveLength(1);
        expect(held.messages[0]?.text).toContain("Ritual · scheduled");
        expect(replies(held)).toEqual([]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Underway");

        yield* call({
          _tag: "UpdateSettings",
          settings: { ...settings, globalBudget: { cost: null, tokens: 200 } },
        });
        for (let index = 0; index < 5; index++) yield* advance(20);
        const released = yield* read(created.missionId);
        expect(released.thread.state).toBe("Resting");
        expect(replies(released)).toEqual(["Echo: claude/claude-sonnet-5-5/default/session none"]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );

  it.effect("runs a due Ritual in its quest, and only a Ritual that is on", () =>
    withService(
      Effect.gen(function* () {
        const hourly: RitualSchedule = { _tag: "Hourly", hours: 1 };
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
        yield* advance(40 * 60 * 1000);
        for (let index = 0; index < 5; index++) yield* advance(20);
        const detail = yield* read(on.missionId);
        expect(detail.messages[0]?.text).toContain("Ritual · scheduled");
        expect(replies(detail)).toHaveLength(1);
        expect((yield* read(off.missionId)).messages).toEqual([]);
        expect((yield* readRitual(on.missionId))?.lastRunAt).not.toBeNull();
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
        expect((yield* read(created.missionId)).messages).toEqual([]);
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

  it.live("keeps the quest as an ordinary one when the Ritual is deleted", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        yield* call({ _tag: "DeleteRitual", ritualId: created.ritualId });
        expect(yield* readRitual(created.missionId)).toBeNull();
        expect((yield* read(created.missionId)).thread.title).toBe("Morning digest");
        // It leaves the Rituals and its quest joins the quests.
        expect(yield* call({ _tag: "ListRituals" })).toEqual([]);
        const { missions } = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        expect(missions.map((mission) => mission.id)).toContain(created.missionId);
      }),
    ),
  );
});
