import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { listVibeModels, makeVibeHarness, readVibeSignIn, vibePlanLimitsOf } from "../../src/index.ts";
import { call, send, settle, startMission, temporary } from "../fixtures/service.ts";
import { answerOpen, idleWith, replies, untilRequested, withHarnesses } from "../fixtures/standIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the Mistral Vibe adapter (`vibe-acp` over ACP) against its stand-in, `stand-in-vibe.mjs`.

const standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-vibe.mjs")];

/** The logged requests of one method, with their params read at the shapes the stand-in logs. */
type PromptParams = { prompt?: Array<{ text?: string }> };
type ConfigParams = { configId?: string; value?: string };
const promptTextsOf = (requests: (method: string) => ReadonlyArray<{ params?: Record<string, unknown> }>) =>
  requests("session/prompt").map(
    (entry) => ((entry.params as PromptParams | undefined)?.prompt ?? []).map((part) => part.text ?? "")[0] ?? "",
  );
const configSetsOf = (requests: (method: string) => ReadonlyArray<{ params?: Record<string, unknown> }>) =>
  requests("session/set_config_option").map((entry) => [
    (entry.params as ConfigParams | undefined)?.configId,
    (entry.params as ConfigParams | undefined)?.value,
  ]);

describe("running a Mistral Vibe thread", () => {
  it.live("echoes the owner's message and gives the first prompt the starting context", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "vibe", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: Hello "]);
      const first = promptTextsOf(requests)[0] ?? "";
      expect(first).toContain("You are thread");
      expect(first).toContain("Hello");
      // The session continues on the next turn in the same process: one session/new, and the second prompt
      // carries the message alone, without the starting context again.
      yield* send(started.threadId, "Again");
      const second = yield* settle(started.missionId, idleWith(2));
      expect(replies(second)).toEqual(["Echo: Hello ", "Echo: Again "]);
      expect(requests("session/new")).toHaveLength(1);
      const prompts = promptTextsOf(requests);
      expect(prompts).toHaveLength(2);
      expect(prompts[1]).not.toContain("You are thread");
      expect(prompts[1]).toContain("Again");
      // Usage is the session's cumulative report read as a delta: one prompt's worth per turn.
      expect(second.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 80, input: 180, output: 16 });
    }).pipe(Effect.provide(layer));
  });

  it.live("sets the ask mode, the model, and the thinking level on the session before the first turn", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({
        effort: "low",
        harness: "vibe",
        model: "mistral-medium-3.5",
        text: "Hello",
      });
      yield* settle(started.missionId, idleWith(1));
      const set = configSetsOf(requests);
      expect(set).toContainEqual(["mode", "ask"]);
      expect(set).toContainEqual(["model", "mistral-medium-3.5"]);
      expect(set).toContainEqual(["thinking", "low"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner about a command, judging from the tool call the session update carried", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "vibe", text: "run git push origin main" });
      const asking = yield* settle(started.missionId, (detail) => detail.questions.length === 1);
      // Vibe's permission request names only the tool call's id.
      const permission = requests("session/request_permission")[0]?.params as { toolCall?: unknown } | undefined;
      expect(permission?.toolCall).toEqual({ toolCallId: "call-1" });
      expect(asking.questions[0]?.details).toContain("git push origin main");
      yield* answerOpen("Allow");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["git push origin main: allow_once "]);
    }).pipe(Effect.provide(layer));
  });

  it.live("carries on after the owner denies, as Vibe does, with the denial answered to it", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "vibe", text: "run git push origin main" });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["git push origin main: reject_once "]);
    }).pipe(Effect.provide(layer));
  });

  it.live("ends the turn as interrupted when the owner interrupts a running turn", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "vibe", text: "slow 5000" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Underway");
      yield* untilRequested(requests, "session/prompt");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Resting");
      expect(replies(detail)).toEqual([]);
      expect(requests("session/cancel")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });
});

describe("the Mistral Vibe adapter alone", () => {
  it.live("restarts the process and loads the session when the thread's model changes", () => {
    const directory = realpathSync(temporary("outlore-vibe-"));
    const log = join(directory, "log.jsonl");
    process.env.STAND_IN_LOG = log;
    return Effect.gen(function* () {
      const harness = yield* makeVibeHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: standIn,
      });
      const first = yield* harness.runTurn(turnRequestOf({ harness: "vibe", model: "mistral-large-4", text: "One" }));
      yield* harness.runTurn(
        turnRequestOf({ harness: "vibe", model: "mistral-medium-3.5", sessionId: first.sessionId, text: "Two" }),
      );
      const logged = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { args?: unknown; method?: string; params?: Record<string, unknown> });
      const starts = logged.filter((entry) => entry.args !== undefined);
      expect(starts).toHaveLength(2);
      expect(logged.filter((entry) => entry.method === "session/new")).toHaveLength(1);
      const load = logged.find((entry) => entry.method === "session/load");
      expect(load?.params?.sessionId).toBe(first.sessionId);
      const set = logged.filter((entry) => entry.method === "session/set_config_option");
      expect(
        set.map((entry) => [
          (entry.params as ConfigParams | undefined)?.configId,
          (entry.params as ConfigParams | undefined)?.value,
        ]),
      ).toContainEqual(["model", "mistral-medium-3.5"]);
    }).pipe(Effect.scoped);
  });

  it.live("starts a new session with the thread's conversation when Vibe cannot load the old one", () => {
    const directory = realpathSync(temporary("outlore-vibe-"));
    const log = join(directory, "log.jsonl");
    process.env.STAND_IN_LOG = log;
    process.env.STAND_IN_VIBE_MISSING_SESSIONS = "vibe-gone";
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* makeVibeHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: standIn,
      });
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          conversationSoFar: Effect.succeed("Earlier words."),
          harness: "vibe",
          onEvent: (event) => Effect.sync(() => events.push(event)),
          sessionId: "vibe-gone",
          text: "Two",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(outcome.sessionId).not.toBe("vibe-gone");
      // The thread was told the session could not be picked up, and the new session's first prompt was given
      // the conversation so far and the starting context.
      expect(events.some((event) => event._tag === "Notice" && event.text.includes("could not pick up"))).toBe(true);
      const prompts = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as { method?: string; params?: PromptParams })
        .filter((entry) => entry.method === "session/prompt")
        .map((entry) => (entry.params?.prompt ?? []).map((part) => part.text ?? "")[0] ?? "");
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toContain("Earlier words.");
      expect(prompts[0]).toContain("Starting context.");
      expect(prompts[0]).toContain("Two");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => delete process.env.STAND_IN_VIBE_MISSING_SESSIONS)));
  });

  it.live("lists the models of its `model` config option, with thinking levels where it says them", () =>
    Effect.gen(function* () {
      const models = yield* listVibeModels(process.execPath, null, standIn);
      expect(models).toEqual([
        {
          efforts: ["off", "low", "medium", "high", "xhigh", "max"],
          id: "mistral-large-4",
          label: "Mistral Large 4",
        },
        { id: "mistral-medium-3.5", label: "Mistral Medium 3.5" },
      ]);
    }),
  );

  it.live("reads who is signed in from its identity and account extensions, never a credential", () =>
    Effect.gen(function* () {
      expect(yield* readVibeSignIn(process.execPath, {}, standIn)).toEqual({
        detail: "owner@example.com · Pro plan",
        signIn: "SignedIn",
      });
    }),
  );

  it("reads the monthly allowance as the plan's limit", () => {
    const report = vibePlanLimitsOf({
      budget: { resetAt: "2026-12-01T00:00:00.000Z", usagePercentage: 40 },
      plan: { kind: "mistral_code", name: "Vibe Code", title: "Vibe Code" },
      status: "ready",
    });
    expect(report).toEqual({
      billing: "Subscription",
      windows: [
        { resetsAtSeconds: Date.parse("2026-12-01T00:00:00.000Z") / 1000, usedPercent: 40, windowMinutes: 43_200 },
      ],
    });
    expect(vibePlanLimitsOf({ plan: { kind: "api" }, status: "ready" })).toBeNull();
  });
});
