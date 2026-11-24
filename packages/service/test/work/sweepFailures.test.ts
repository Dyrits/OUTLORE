import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { advance } from "../fixtures/rituals.ts";
import { call, read, withService as runIn, start } from "../fixtures/service.ts";

// A timed sweep that fails once, as a busy database does, runs again at its next time instead of stopping for the
// rest of the session (architecture audit 2026-11-24, S4). The failure is a trigger that aborts the sweep's write.

const minute = 60 * 1000;

describe("a sweep whose write fails once", () => {
  it.effect("keeps the Ritual scheduler running, so the Ritual runs a few minutes late", () =>
    runIn(
      Effect.gen(function* () {
        const created = yield* call({
          _tag: "CreateRitual",
          fallbacks: [],
          instruction: "runner",
          primary: { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" },
          requestId: crypto.randomUUID(),
          schedule: { _tag: "Hourly", hours: 1 },
          title: "Morning digest",
          workspacePath: null,
        });
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TRIGGER fail_schedule BEFORE UPDATE ON rituals
          BEGIN SELECT RAISE(ABORT, 'database is busy'); END`;
        yield* advance(61 * minute);
        expect((yield* call({ _tag: "ReadRitual", missionId: created.missionId }))?.lastRunAt).toBeNull();

        yield* sql`DROP TRIGGER fail_schedule`;
        // Within the five minutes of grace a run keeps after its time.
        yield* advance(3 * minute);
        const ritual = yield* call({ _tag: "ReadRitual", missionId: created.missionId });
        expect(ritual?.lastRunAt).not.toBeNull();
      }),
    ),
  );

  it.effect("keeps the budget-period sweep running, so a held thread is released a sweep later", () =>
    runIn(
      Effect.gen(function* () {
        yield* call({ _tag: "ReadSettings" }).pipe(
          Effect.flatMap((settings) =>
            call({
              _tag: "UpdateSettings",
              settings: { ...settings, globalBudget: { cost: null, tokens: 100 }, globalBudgetPeriod: "Day" },
            }),
          ),
        );
        const started = yield* start("spend 100");
        for (let index = 0; index < 5; index++) yield* advance(20);
        const held = yield* read(started.missionId);
        expect(held.thread.blocker).toBe("Budget");
        const sql = yield* SqlClient.SqlClient;
        yield* sql`CREATE TRIGGER fail_release BEFORE UPDATE ON threads
          BEGIN SELECT RAISE(ABORT, 'database is busy'); END`;
        // The period starts over at the next local midnight, within a day; the sweep that releases fails there.
        yield* advance(25 * 60 * minute);
        expect((yield* read(started.missionId)).thread.blocker).toBe("Budget");

        yield* sql`DROP TRIGGER fail_release`;
        yield* advance(2 * 60 * minute);
        expect((yield* read(started.missionId)).thread.state).toBe("Resting");
      }),
    ),
  );
});
