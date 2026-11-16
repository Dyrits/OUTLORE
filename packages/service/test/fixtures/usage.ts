import type { UsageFilter, UsagePeriod } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { call, settle, start } from "./service.ts";

// The usage page's cases (usageReport.test.ts, usageFilters.test.ts) share one small world: three quests in two realms and
// the Borderlands, and a month of turns across harnesses, models, billing kinds, and known and unknown prices.

export const isIdle = (detail: { thread: { state: string } }) => detail.thread.state === "Idle";
export const last30: UsagePeriod = { _tag: "Days", days: 30 };
export const usage = (period: UsagePeriod = last30, filters: UsageFilter[] = []) =>
  call({ _tag: "ReadUsage", filters, period });

/** The local calendar day `ago` days before today, at `hour`, in milliseconds. */
export const dayAt = (ago: number, hour = 12, minute = 0, second = 0, millisecond = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - ago);
  date.setHours(hour, minute, second, millisecond);
  return date.getTime();
};
// Written out here, not taken from the service: the expected day texts must not come from the code they check.
export const dayText = (ago: number) => {
  const date = new Date(dayAt(ago));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export interface Seed {
  readonly account?: string | null;
  readonly billing: "Subscription" | "ApiKey" | "Unknown" | null;
  readonly cost?: number | null;
  readonly endedAt: number;
  readonly estimate?: number | null;
  readonly harness: "claude" | "codex" | "opencode" | null;
  readonly mission: string;
  readonly model: string | null;
  readonly thread: string;
  readonly tokens?: readonly [number, number, number, number];
}

/** A subscription turn's usage row for one of `quests`' quests, ended at `endedAt`. */
export const subscriptionRow = (quest: { mission: string; thread: string }, endedAt: number) =>
  ({
    billing: "Subscription",
    endedAt,
    estimate: 1,
    harness: "claude",
    mission: quest.mission,
    model: "m",
    thread: quest.thread,
  }) as const;

/** Replaces the usage the fake harness left with `rows`, which name the quests and threads they belong to. */
export const seed = (rows: readonly Seed[]) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`DELETE FROM usage`;
    let index = 0;
    for (const row of rows) {
      const [input, output, cacheCreation, cacheRead] = row.tokens ?? [10, 5, 0, 0];
      yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation,
          cost, billing, harness, model, account_id, estimate)
        VALUES (${`turn-${index++}`}, ${row.mission}, ${row.thread}, ${row.endedAt}, ${input}, ${output}, ${cacheRead},
          ${cacheCreation}, ${row.cost ?? null}, ${row.billing}, ${row.harness}, ${row.model}, ${row.account ?? null},
          ${row.estimate ?? null})`;
    }
  });

/** Three quests: one in the realm Atlas, one in the realm Borealis, one in the Borderlands. */
export const quests = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const made = [];
  for (const title of ["Quest A", "Quest B", "Quest C"]) {
    const quest = yield* start(title);
    yield* settle(quest.missionId, isIdle);
    made.push(quest);
  }
  yield* sql`INSERT INTO workspaces (id, name, path, created_at) VALUES ('realm-atlas', 'Atlas', NULL, 1), ('realm-borealis', 'Borealis', NULL, 2)`;
  const [atlas, borealis, borderlands] = made;
  if (atlas === undefined || borealis === undefined || borderlands === undefined) return yield* Effect.die("quests");
  yield* sql`UPDATE threads SET workspace_id = 'realm-atlas' WHERE mission_id = ${atlas.missionId}`;
  yield* sql`UPDATE threads SET workspace_id = 'realm-borealis' WHERE mission_id = ${borealis.missionId}`;
  const [threadAtlas] = yield* sql<{ id: string }>`SELECT id FROM threads WHERE mission_id = ${atlas.missionId}`;
  const [threadBorealis] = yield* sql<{ id: string }>`SELECT id FROM threads WHERE mission_id = ${borealis.missionId}`;
  const [threadBorderlands] = yield* sql<{
    id: string;
  }>`SELECT id FROM threads WHERE mission_id = ${borderlands.missionId}`;
  return {
    atlas: { mission: atlas.missionId as string, thread: threadAtlas?.id ?? "" },
    borderlands: { mission: borderlands.missionId as string, thread: threadBorderlands?.id ?? "" },
    borealis: { mission: borealis.missionId as string, thread: threadBorealis?.id ?? "" },
  };
});

/** The usage of the cases below: several harnesses, models, realms, days, billing kinds, known and unknown prices. */
export const standard = Effect.gen(function* () {
  const { atlas, borealis, borderlands } = yield* quests;
  yield* seed([
    // Claude, a subscription turn estimated at $1.00: 100 uncached input, 30 output, 20 cache creation, 1,000 cache reads.
    {
      billing: "Subscription",
      endedAt: dayAt(1),
      estimate: 1,
      harness: "claude",
      mission: atlas.mission,
      model: "claude-sonnet-5-5",
      thread: atlas.thread,
      tokens: [100, 30, 20, 1000],
    },
    // Claude on an API key, with the cost the harness reported.
    {
      billing: "ApiKey",
      cost: 2,
      endedAt: dayAt(1, 18),
      harness: "claude",
      mission: borealis.mission,
      model: "claude-opus-5-5",
      thread: borealis.thread,
      tokens: [10, 10, 0, 0],
    },
    {
      account: "acct-work",
      billing: "Subscription",
      endedAt: dayAt(2),
      estimate: 0.5,
      harness: "codex",
      mission: atlas.mission,
      model: "gpt-5.1-codex",
      thread: atlas.thread,
    },
    // A model with a known price of zero.
    {
      billing: "Subscription",
      endedAt: dayAt(2, 14),
      estimate: 0,
      harness: "codex",
      mission: borderlands.mission,
      model: "free-model",
      thread: borderlands.thread,
    },
    // A model the price table does not know: its tokens count, its cost is unavailable.
    {
      billing: "Subscription",
      endedAt: dayAt(2, 9),
      harness: "opencode",
      mission: borderlands.mission,
      model: "x/unknown",
      thread: borderlands.thread,
      tokens: [5, 5, 0, 0],
    },
    // A turn from before billing kinds and models were recorded.
    {
      billing: null,
      endedAt: dayAt(3),
      harness: null,
      mission: atlas.mission,
      model: null,
      thread: atlas.thread,
      tokens: [2, 1, 0, 0],
    },
    // Outside every period below.
    {
      billing: "Subscription",
      endedAt: dayAt(40),
      estimate: 9,
      harness: "claude",
      mission: atlas.mission,
      model: "claude-sonnet-5-5",
      thread: atlas.thread,
    },
  ]);
  return { atlas, borderlands, borealis };
});
