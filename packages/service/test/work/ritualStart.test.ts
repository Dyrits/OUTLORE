import { describe, expect, it } from "@effect/vitest";
import type { MissionId, RitualCompanion } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { call, read, withService } from "../fixtures/service.ts";

// A scheduled Ritual run whose start fails is made visible, and leaves no half-made run (rituals, fault injection).

const claude: RitualCompanion = { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" };
const codex: RitualCompanion = { accountId: null, effort: "default", harness: "codex", model: "gpt-5" };

const advance = (millis: number) =>
  Effect.gen(function* () {
    yield* TestClock.adjust(millis);
    for (let index = 0; index < 40; index++) yield* Effect.yieldNow;
  });

/** Creates an hourly Ritual on the given Companion; the instruction is the fake harness's script. */
const createHourly = (primary: RitualCompanion) =>
  call({
    _tag: "CreateRitual",
    fallbacks: [],
    instruction: "runner",
    primary,
    requestId: crypto.randomUUID(),
    schedule: { _tag: "Hourly", hours: 1 },
    title: "Morning digest",
    workspacePath: null,
  });

const readRitual = (missionId: MissionId) => call({ _tag: "ReadRitual", missionId });

describe("a scheduled Ritual run that cannot start", () => {
  it.effect("fails the run with the reason when the primary Companion's account was removed", () =>
    withService(
      Effect.gen(function* () {
        const accounts = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
        const accountId = accounts.harnesses.find((harness) => harness.name === "claude")?.accounts[1]?.id;
        if (accountId === undefined || accountId === null) return yield* Effect.die("Missing added account");
        const created = yield* createHourly({ ...claude, accountId });
        // The thread had fallen back to the computer's own sign-in, so the account is free to be removed.
        const sql = yield* SqlClient.SqlClient;
        yield* sql`UPDATE threads SET account_id = NULL WHERE mission_id = ${created.missionId}`;
        yield* call({ _tag: "RemoveAccount", accountId });

        yield* advance(70 * 60 * 1000);

        const ritual = yield* readRitual(created.missionId);
        expect(ritual?.lastRunState).toBe("Failed");
        expect(ritual?.lastRunAt).not.toBeNull();
        // The Ritual still moves to its next time, so the failure is not repeated every minute.
        expect(ritual?.nextRunAt).toBeGreaterThan(70 * 60 * 1000);
        const detail = yield* read(created.missionId);
        expect(detail.thread.state).toBe("Failed");
        expect(detail.thread.failure).toMatch(/^Could not start the scheduled run: /);
        expect(detail.messages).toEqual([]);
      }),
    ),
  );

  it.effect("leaves no partial run behind when a write fails after the Companion was changed", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* createHourly(claude);
        const sql = yield* SqlClient.SqlClient;
        // The thread had fallen back to Codex, so starting a run changes its Companion back to the primary one first.
        yield* sql`UPDATE threads SET harness = 'codex', model = 'gpt-5' WHERE mission_id = ${created.missionId}`;
        yield* sql`CREATE TRIGGER fail_run_marker BEFORE INSERT ON ritual_run_messages
          BEGIN SELECT RAISE(ABORT, 'injected failure'); END`;

        yield* advance(70 * 60 * 1000);

        const [thread] = yield* sql<{ harness: string }>`SELECT harness FROM threads
          WHERE mission_id = ${created.missionId}`;
        expect(thread?.harness).toBe(codex.harness);
        const detail = yield* read(created.missionId);
        expect(detail.messages).toEqual([]);
        expect(detail.thread.state).toBe("Failed");
        expect(detail.thread.failure).toMatch(/^Could not start the scheduled run: /);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Failed");
      }),
    ),
  );
});
