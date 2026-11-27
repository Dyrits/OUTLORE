import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { fakeHarnessToolsLayer, HarnessTools } from "../../src/harness/index.ts";
import { companionRows, repliesOf, restedQuest, token, turnCountOf } from "../fixtures/companions.ts";
import { call, fixture, register, send, settle, withService } from "../fixtures/service.ts";

// Refusals when a mentioned Companion cannot answer (thread-messaging, Mentioning a Companion with @; CHG-0781, CHG-0788).

// The owner's real reading (2026-11-27): Gemini has room, "Others" (Claude and GPT models) is used up until Dec 2.
const antigravityWindows = (geminiWeekly: number, resetsAt: number) => [
  { label: "Gemini · Weekly", resetsAt: resetsAt + 1_000, usedPercent: geminiWeekly, windowMinutes: 10_080 },
  { label: "Gemini · 5-hour", resetsAt: resetsAt + 2_000, usedPercent: 0, windowMinutes: 300 },
  { label: "Others · Weekly", resetsAt, usedPercent: 100, windowMinutes: 10_080 },
];

const storeAntigravityWindows = (windows: ReadonlyArray<object>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    yield* sql`INSERT INTO plan_limits (account_key, windows, read_at) VALUES ('antigravity:', ${JSON.stringify(windows)}, ${Date.now()})`;
  });

describe("a Companion that cannot answer", () => {
  it.live("says its account is no longer in Outlore, and leaves the main Companion untouched", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("claude-opus-5-5", "claude", "gone-account")} still there?`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "claude-opus-5-5").length === 1);
        expect(repliesOf(detail, "claude-opus-5-5")[0]?.text).toBe(
          "Cannot answer: its account is no longer in Outlore",
        );
        const rows = yield* companionRows;
        expect(yield* turnCountOf(rows[0]?.threadId ?? "")).toBe(0);
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
      }),
    ),
  );

  it.live("says its account is signed out", () => {
    const signedOut = Layer.effect(
      HarnessTools,
      Effect.gen(function* () {
        const base = yield* HarnessTools;
        return { ...base, readSignIn: () => Effect.succeed({ detail: null, signIn: "SignedOut" as const }) };
      }),
    ).pipe(Layer.provide(fakeHarnessToolsLayer()));
    return Effect.gen(function* () {
      const quest = yield* restedQuest;
      yield* send(quest.threadId, `${token("gpt-5")} anyone?`);
      const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 1);
      expect(repliesOf(detail, "gpt-5")[0]?.text).toBe("Cannot answer: its account is signed out");
      expect(yield* turnCountOf(quest.threadId)).toBe(1);
    }).pipe(Effect.provide(register(fixture(signedOut)).layer));
  });

  it.live("says its account's budget is reached", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* call({
          _tag: "SetAccountBudget",
          accountId: null,
          harness: "codex",
          limits: { cost: null, tokens: 1 },
          period: "Month",
          since: null,
        });
        const sql = yield* SqlClient.SqlClient;
        yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation, billing, harness, model)
          SELECT id, ${quest.missionId}, thread_id, started_at, 5, 5, 0, 0, 'Subscription', 'codex', 'gpt-5' FROM turns LIMIT 1`;
        yield* send(quest.threadId, `${token("gpt-5")} anyone?`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 1);
        expect(repliesOf(detail, "gpt-5")[0]?.text).toContain("Cannot answer: its account's budget is reached");
      }),
    ),
  );

  it.live("says its usage limit is reached and when it resets", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const sql = yield* SqlClient.SqlClient;
        const resetsAt = Date.now() + 3_600_000;
        yield* sql`INSERT INTO plan_limits (account_key, windows, read_at) VALUES ('codex:', ${JSON.stringify([
          { label: "5-hour", resetsAt, usedPercent: 100, windowMinutes: 300 },
        ])}, ${Date.now()})`;
        yield* send(quest.threadId, `${token("gpt-5")} anyone?`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 1);
        const text = repliesOf(detail, "gpt-5")[0]?.text ?? "";
        expect(text).toContain("Cannot answer: its usage limit is reached (resets at ");
        expect(text).not.toContain("NaN");
      }),
    ),
  );

  it.live("does not refuse a Gemini model for the used-up limit of the other model group", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* storeAntigravityWindows(antigravityWindows(39.85, Date.now() + 3_600_000));
        const model = "gemini-4-neon-medium";
        yield* send(quest.threadId, `${token(model, "antigravity")} Do you have access to Composio?`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, model).length === 1);
        expect(repliesOf(detail, model)[0]?.text).not.toContain("Cannot answer");
      }),
    ),
  );

  it.live("refuses a model of the used-up group, with that group's reset", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* storeAntigravityWindows(antigravityWindows(39.85, Date.now() + 3_600_000));
        yield* send(quest.threadId, `${token("claude-opus-5-5", "antigravity")} anyone?`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "claude-opus-5-5").length === 1);
        expect(repliesOf(detail, "claude-opus-5-5")[0]?.text).toContain(
          "Cannot answer: its usage limit is reached (resets at ",
        );
      }),
    ),
  );

  it.live("refuses a Gemini model when its own group's window is used up", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* storeAntigravityWindows(antigravityWindows(100, Date.now() + 3_600_000));
        const model = "gemini-4-neon-medium";
        yield* send(quest.threadId, `${token(model, "antigravity")} anyone?`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, model).length === 1);
        expect(repliesOf(detail, model)[0]?.text).toContain("Cannot answer: its usage limit is reached");
      }),
    ),
  );

  it.live("tells the latest reset when several of its limits are used up", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const soon = Date.now() + 3_600_000;
        const later = Date.now() + 5 * 86_400_000;
        yield* storeAntigravityWindows([
          { label: "Gemini · 5-hour", resetsAt: soon, usedPercent: 100, windowMinutes: 300 },
          { label: "Gemini · Weekly", resetsAt: later, usedPercent: 100, windowMinutes: 10_080 },
        ]);
        const model = "gemini-4-neon-medium";
        yield* send(quest.threadId, `${token(model, "antigravity")} anyone?`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, model).length === 1);
        const day = new Date(later).toLocaleDateString([], { day: "numeric", month: "short" });
        expect(repliesOf(detail, model)[0]?.text).toContain(day);
      }),
    ),
  );

  it.live("says why a turn that failed did, and gives the question to no one else", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} fail codex No capacity`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 1);
        expect(repliesOf(detail, "gpt-5")[0]?.text).toContain("Cannot answer: the turn failed");
        expect(repliesOf(detail, "gpt-5")[0]?.text).toContain("No capacity");
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        // The failed question is not delivered again with the next one.
        yield* send(quest.threadId, `${token("gpt-5")} second try`);
        const next = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 2);
        expect(repliesOf(next, "gpt-5")[1]?.text).not.toContain("fail codex");
      }),
    ),
  );
});
