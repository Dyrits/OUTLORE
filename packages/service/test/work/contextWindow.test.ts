import { describe, expect, it } from "@effect/vitest";
import type { ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { contextLimitOf, contextSoftLimit, contextWindowFallback } from "../../src/lore/index.ts";
import { readConversationSoFar } from "../../src/work/handover.ts";
import { call, fixture, read, send, settle, startMission } from "../fixtures/service.ts";

// The context window each turn reports, and the soft limit every model is held to (thread-panel, The context gauge).

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

const isIdle = (detail: { thread: { state: string } }) => detail.thread.state === "Resting";
/** A quest on `model` whose first turn reported `lines`, finished. */
const quest = (model: string, lines: string) =>
  Effect.gen(function* () {
    const started = yield* startMission({ model, text: lines });
    yield* settle(started.missionId, isIdle);
    return started;
  });
const panelOf = (threadId: ThreadId) => call({ _tag: "ReadThreadPanel", threadId });

describe("the effective limit", () => {
  it("is 272,000 tokens as one named soft limit", () => {
    expect(contextSoftLimit).toBe(272_000);
    expect(contextWindowFallback).toBe(200_000);
  });

  it("keeps a smaller window, holds a larger one to the soft limit, and counts 200,000 with no report", () => {
    expect(contextLimitOf(128_000)).toEqual({ isSoftLimit: false, tokens: 128_000 });
    expect(contextLimitOf(272_000)).toEqual({ isSoftLimit: false, tokens: 272_000 });
    expect(contextLimitOf(1_000_000)).toEqual({ isSoftLimit: true, tokens: 272_000 });
    expect(contextLimitOf(null)).toEqual({ isSoftLimit: false, tokens: 200_000 });
  });
});

describe("storing the window a turn reports", () => {
  it.live("keeps it with the turn's usage, and null when the harness reported none", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      yield* quest("m-reports", "spend 1000\nwindow 128000");
      yield* quest("m-silent", "spend 1000");
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT model, context_window AS contextWindow FROM usage ORDER BY model`).toEqual([
        { contextWindow: 128_000, model: "m-reports" },
        { contextWindow: null, model: "m-silent" },
      ]);
    }).pipe(Effect.provide(layer));
  });
});

describe("the gauge reads the reported window", () => {
  it.live("shows a small model's own window, a large one held to the soft limit, and 200,000 with no report", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const small = yield* quest("m-small", "spend 50000\nwindow 128000");
      const large = yield* quest("m-large", "spend 50000\nwindow 1000000");
      const silent = yield* quest("m-silent", "spend 50000");
      expect((yield* panelOf(small.threadId)).context).toMatchObject({ isSoftLimit: false, windowTokens: 128_000 });
      expect((yield* panelOf(large.threadId)).context).toMatchObject({ isSoftLimit: true, windowTokens: 272_000 });
      expect((yield* panelOf(silent.threadId)).context).toMatchObject({ isSoftLimit: false, windowTokens: 200_000 });
      // The lore gauge counts the same limit.
      expect((yield* read(small.missionId, small.threadId)).loreGauge.windowTokens).toBe(128_000);
      expect((yield* read(large.missionId, large.threadId)).loreGauge).toMatchObject({
        isSoftLimit: true,
        windowTokens: 272_000,
      });
      expect((yield* read(silent.missionId, silent.threadId)).loreGauge.windowTokens).toBe(200_000);
    }).pipe(Effect.provide(layer));
  });

  it.live("follows the model's latest report", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const started = yield* quest("m-changing", "spend 1000\nwindow 128000");
      yield* send(started.threadId, "spend 1000\nwindow 150000");
      yield* settle(started.missionId, (detail) => isIdle(detail) && detail.messages.length >= 4);
      expect((yield* panelOf(started.threadId)).context?.windowTokens).toBe(150_000);
    }).pipe(Effect.provide(layer));
  });

  it.live("gives a thread on the harness's default model the window its latest turn reported", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const started = yield* quest("default", "spend 1000\nwindow 1000000");
      expect((yield* panelOf(started.threadId)).context).toMatchObject({ isSoftLimit: true, windowTokens: 272_000 });
    }).pipe(Effect.provide(layer));
  });

  it.live("holds the starting context's warning to the same limit", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const small = yield* quest("m-small", "spend 1000\nwindow 128000");
      yield* quest("m-large", "spend 1000\nwindow 1000000");
      const preview = (model: string) =>
        call({ _tag: "PreviewStartingContext", model, parentThreadId: small.threadId, text: "Go on." });
      expect(yield* preview("m-small")).toMatchObject({ windowTokens: 128_000 });
      expect(yield* preview("m-large")).toMatchObject({ windowTokens: 272_000 });
      expect(yield* preview("m-unknown")).toMatchObject({ windowTokens: 200_000 });
    }).pipe(Effect.provide(layer));
  });
});

describe("the handover allowance", () => {
  /** The replay of a thread whose one owner message holds `tokens` tokens, on a model that reported `lines`. */
  const replayOf = (model: string, lines: string, tokens: number) =>
    Effect.gen(function* () {
      const started = yield* quest(model, lines);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE messages SET text = ${"x".repeat(tokens * 4)} WHERE thread_id = ${started.threadId} AND sender_kind = 'user'`;
      return yield* readConversationSoFar(started.threadId, "next-turn", model);
    });

  it.live("is half the reported window, up to half the soft limit", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      // 120,000 tokens: over half of a 200,000 or 128,000 window, under half of the 272,000 soft limit.
      expect(yield* replayOf("m-silent", "spend 10", 120_000)).toContain("1 earlier message was left out");
      expect(yield* replayOf("m-small", "spend 10\nwindow 128000", 120_000)).toContain(
        "1 earlier message was left out",
      );
      expect(yield* replayOf("m-large", "spend 10\nwindow 1000000", 120_000)).not.toContain("left out");
      // 140,000 tokens is over half of the soft limit too.
      expect(yield* replayOf("m-larger", "spend 10\nwindow 1000000", 140_000)).toContain(
        "1 earlier message was left out",
      );
    }).pipe(Effect.provide(layer));
  });
});

describe("warning at the soft limit", () => {
  const warningsOf = (detail: { handovers: ReadonlyArray<{ text: string }> }) =>
    detail.handovers.filter((line) => line.text.includes("context")).map((line) => line.text);

  it.live("writes one line when the thread's context reaches 272,000 tokens, saying it is a soft limit", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const started = yield* quest("m-large", "spend 100000\nwindow 1000000");
      expect(warningsOf(yield* read(started.missionId, started.threadId))).toEqual([]);
      yield* send(started.threadId, "spend 272000\nwindow 1000000");
      const reached = yield* settle(started.missionId, (detail) => isIdle(detail) && detail.messages.length >= 4);
      const [line, ...others] = warningsOf(reached);
      expect(others).toEqual([]);
      expect(line).toContain("soft limit of 272,000 tokens");
      expect(line).toContain("keeps working past it");
      expect(line).toContain("new errand");
      // Still past the limit on the next turn: the line is not repeated.
      yield* send(started.threadId, "spend 280000\nwindow 1000000");
      expect(
        warningsOf(yield* settle(started.missionId, (detail) => isIdle(detail) && detail.messages.length >= 6)),
      ).toHaveLength(1);
      // Back under it, then over it again: a new line.
      yield* send(started.threadId, "spend 20000\nwindow 1000000");
      yield* settle(started.missionId, (detail) => isIdle(detail) && detail.messages.length >= 8);
      yield* send(started.threadId, "spend 290000\nwindow 1000000");
      expect(
        warningsOf(yield* settle(started.missionId, (detail) => isIdle(detail) && detail.messages.length >= 10)),
      ).toHaveLength(2);
    }).pipe(Effect.provide(layer));
  });

  it.live("warns at a smaller model's own window, without calling it a soft limit", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const started = yield* quest("m-small", "spend 128000\nwindow 128000");
      const [line] = warningsOf(yield* read(started.missionId, started.threadId));
      expect(line).toContain("128,000 tokens");
      expect(line).not.toContain("soft limit");
    }).pipe(Effect.provide(layer));
  });

  it.live("says nothing below the limit or for a thread that reported no context", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const under = yield* quest("m-large", "spend 271999\nwindow 1000000");
      const silent = yield* quest("m-silent", "Hello");
      expect(warningsOf(yield* read(under.missionId, under.threadId))).toEqual([]);
      expect(warningsOf(yield* read(silent.missionId, silent.threadId))).toEqual([]);
    }).pipe(Effect.provide(layer));
  });
});
