import { describe, expect, it } from "@effect/vitest";
import type { MissionId, RitualCompanion } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { advance } from "../fixtures/rituals.ts";
import { call, read, withService as runIn } from "../fixtures/service.ts";

// A scheduled Ritual run whose start fails is made visible, and leaves no half-made run (rituals, fault injection).
// A Ritual is an entity of its realm (CHG-0616): the failure line lands in its conversation, and its conversation
// thread stays Resting — no errand was opened, and nothing woke it.

const claude: RitualCompanion = { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" };

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

/** The Ritual's conversation, which holds only the service's run lines. */
const conversation = (missionId: MissionId) => read(missionId);

describe("a scheduled Ritual run that cannot start", () => {
  it.effect("fails the run with the reason in its conversation when the primary Companion's account was removed", () =>
    runIn(
      Effect.gen(function* () {
        const accounts = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
        const accountId = accounts.harnesses.find((harness) => harness.name === "claude")?.accounts[1]?.id;
        if (accountId === undefined || accountId === null) return yield* Effect.die("Missing added account");
        const created = yield* createHourly({ ...claude, accountId });
        const sql = yield* SqlClient.SqlClient;
        // The Ritual's conversation thread had fallen back to the computer's own sign-in, so the account is free to
        // go; its errands would still have started on it (thread-handover keeps the account's conversation).
        yield* sql`UPDATE threads SET account_id = NULL WHERE mission_id = ${created.missionId}`;
        yield* call({ _tag: "RemoveAccount", accountId });

        yield* advance(70 * 60 * 1000);

        const ritual = yield* readRitual(created.missionId);
        expect(ritual?.lastRunState).toBe("Failed");
        expect(ritual?.lastRunAt).not.toBeNull();
        // The Ritual still moves to its next time, so the failure is not repeated every minute.
        expect(ritual?.nextRunAt).toBeGreaterThan(70 * 60 * 1000);
        const detail = yield* conversation(created.missionId);
        expect(detail.thread.state).toBe("Resting");
        expect(detail.messages).toHaveLength(1);
        expect(detail.messages[0]?.text).toMatch(/^Could not start the scheduled run: /);
        // No errand opened beneath the Ritual.
        expect(detail.threads).toHaveLength(1);
      }),
    ),
  );

  it.effect("leaves no partial run behind when a write fails after the trigger line was written", () =>
    runIn(
      Effect.gen(function* () {
        const created = yield* createHourly(claude);
        const sql = yield* SqlClient.SqlClient;
        // The run's errand is the start's last big write, so the failure aborts with the trigger line already written:
        // the whole start must roll back, leaving only the failure line.
        yield* sql`CREATE TRIGGER fail_run_marker BEFORE INSERT ON threads
          BEGIN SELECT RAISE(ABORT, 'injected failure'); END`;

        yield* advance(70 * 60 * 1000);

        const detail = yield* conversation(created.missionId);
        expect(detail.messages).toHaveLength(1);
        expect(detail.messages[0]?.text).toMatch(/^Could not start the scheduled run: /);
        expect(detail.thread.state).toBe("Resting");
        expect(detail.threads).toHaveLength(1);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Failed");
        // The rolled-back start's marking is gone, again: only the failure line's.
        const [marked] = yield* sql<{ count: number }>`SELECT COUNT(*) AS count FROM ritual_run_messages`;
        expect(marked?.count).toBe(1);
      }),
    ),
  );
});

// The one-run-at-a-time, grace, and budget rules are covered in ritualSchedulingAndEditing.test.ts.
