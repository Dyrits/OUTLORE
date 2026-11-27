import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { fakeHarnessToolsLayer, HarnessTools } from "../../src/harness/index.ts";
import { call, fixture, read, register, send, settle, withService } from "../fixtures/service.ts";

// A message that names a Companion with @ (thread-messaging, Mentioning a Companion with @; CHG-0781): the named model
// answers in a hidden quest of its own, its answer is copied under the owner's message, and the conversation's own
// Companion carries on and is told of both as context only.

import { companionRows, isRested, repliesOf, restedQuest, token, turnCountOf } from "../fixtures/companions.ts";

describe("asking a Companion with @", () => {
  it.live("answers in the same conversation under the owner's message, once, labelled with its model", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const sent = yield* send(quest.threadId, `${token("gpt-5")} what is two plus two`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length > 0);
        const [reply] = repliesOf(detail, "gpt-5");
        expect(reply?.text).toContain("what is two plus two");
        expect(reply).toMatchObject({ harness: "codex", model: "gpt-5", replyToMessageId: sent.messageId });
        expect(reply?.fromTitle).not.toBeNull();
        const owner = detail.messages.find((message) => message.id === sent.messageId);
        expect(owner).toMatchObject({ isDelivered: true, isQueued: false, sender: "user" });
        yield* Effect.sleep("150 millis");
        expect(repliesOf(yield* read(quest.missionId), "gpt-5")).toHaveLength(1);
      }),
    ),
  );

  it.live("leaves the main Companion's turns, state and session as they were", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        yield* send(quest.threadId, `${token("gpt-5")} hello there`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length > 0);
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        const detail = yield* read(quest.missionId);
        expect(detail.thread).toMatchObject({ harness: "claude", state: "Resting" });
        expect(detail.thread.actions.isInTurn).toBe(false);
      }),
    ),
  );

  it.live("answers while the main Companion is in a turn, which carries on", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, "wait 200\nMain work");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Underway");
        yield* send(quest.threadId, `${token("gpt-5")} side question`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length > 0);
        // The main Companion's own turn was not ended or replaced by the other model's.
        const detail = yield* settle(
          quest.missionId,
          (current) =>
            isRested(current) &&
            current.messages.filter((message) => message.sender === "agent" && message.model === null).length === 2,
        );
        expect(detail.thread.harness).toBe("claude");
        expect(yield* turnCountOf(quest.threadId)).toBe(2);
      }),
    ),
  );

  it.live("keeps one thread per model and conversation: a second mention resumes it, another model gets its own", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} first`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        yield* send(quest.threadId, `${token("gpt-5")} second`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 2);
        // The second question carries only what was said since the first answer, and no copy of the first exchange.
        expect(repliesOf(detail, "gpt-5")[1]?.text).not.toContain("first");
        const rows = yield* companionRows;
        expect(rows).toHaveLength(1);
        expect(yield* turnCountOf(rows[0]?.threadId ?? "")).toBe(2);
        yield* send(quest.threadId, `${token("gpt-6")} third`);
        yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-6").length === 1);
        expect(yield* companionRows).toHaveLength(2);
      }),
    ),
  );

  it.live("shows a later Companion what was said since it last looked", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} first`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        yield* send(quest.threadId, "A remark between");
        yield* settle(
          quest.missionId,
          (detail) => isRested(detail) && detail.messages.at(-1)?.text.includes("A remark between") === true,
        );
        yield* send(quest.threadId, `${token("gpt-5")} second`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 2);
        expect(repliesOf(detail, "gpt-5")[1]?.text).toContain("A remark between");
      }),
    ),
  );

  it.live("tells the main Companion of the message and the answer once, as context that starts no turn", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} Sky colour?`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        yield* Effect.sleep("100 millis");
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        yield* send(quest.threadId, "Carry on");
        const detail = yield* settle(
          quest.missionId,
          (current) => isRested(current) && current.messages.at(-1)?.text.includes("Carry on") === true,
        );
        const told = detail.messages.at(-1)?.text ?? "";
        expect(told).toContain("gpt-5");
        expect(told).toContain("Sky colour?");
        expect(told).toContain("context only");
        yield* send(quest.threadId, "Once more");
        const later = yield* settle(
          quest.missionId,
          (current) => isRested(current) && current.messages.at(-1)?.text.includes("Once more") === true,
        );
        expect(later.messages.at(-1)?.text).not.toContain("Sky colour?");
        expect(yield* turnCountOf(quest.threadId)).toBe(3);
      }),
    ),
  );
});

describe("a Companion that cannot answer", () => {
  it.live("says its account is no longer in Outlore, and the main Companion only receives it as context", () =>
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
