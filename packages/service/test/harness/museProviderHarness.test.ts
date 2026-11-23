import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import type { HarnessEvent, HarnessPrompt, PromptAnswer } from "../../src/core/index.ts";
import { makeMuseHarness } from "../../src/harness/muse.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the Muse harness (`makeMuseHarness`) against its stand-in, museProviderFake.mjs: one kept
// `muse serve` host a thread, one `session/start` a session, turns as `turn/start`, approvals mediated by
// the owner through the fail-closed choice seam, and the events Muse drops spliced back by `view/page`.

type LoggedEntry = {
  method?: string;
  params?: Record<string, unknown>;
};

const readEntries = (log: string): Array<LoggedEntry> =>
  existsSync(log)
    ? readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as LoggedEntry)
    : [];

/** Waits until the stand-in has logged an entry the check cares about. */
const untilLogged = (log: string, predicate: (entry: LoggedEntry) => boolean) =>
  Effect.promise(async () => {
    for (let attempt = 0; attempt < 250; attempt += 1) {
      if (readEntries(log).some(predicate)) return;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  });

const fixture = join(import.meta.dirname, "../fixtures/museProviderFake.mjs");
const harnessOf = (scenario: string, log: string, env: Record<string, string> = {}) =>
  makeMuseHarness({
    command: process.execPath,
    env: { MUSE_FAKE_LOG: log, ...env },
    idleTimeout: "10 minutes",
    prefixArgs: [fixture, scenario],
  });

/** The prompts and answer the owner was asked with; a fixed decision, or none forever. */
const answersOf = (isAllowed: boolean) => {
  const prompts: Array<HarnessPrompt> = [];
  return {
    answer: (prompt: HarnessPrompt): PromptAnswer => {
      prompts.push(prompt);
      return { isAllowed, text: "" };
    },
    prompts,
  };
};

const runScenario = (
  scenario: string,
  request: Partial<Parameters<typeof turnRequestOf>[0]>,
  askOwner?: (prompt: HarnessPrompt) => PromptAnswer,
) => {
  const directory = mkdtempSync(join(tmpdir(), "outlore-muse-"));
  const log = join(directory, "calls");
  const events: Array<HarnessEvent> = [];
  const effect = Effect.gen(function* () {
    const harness = yield* harnessOf(scenario, log);
    return yield* harness.runTurn(
      turnRequestOf({
        onEvent: (event) => Effect.sync(() => events.push(event)),
        ...(askOwner === undefined ? {} : { askOwner: (prompt) => Effect.sync(() => askOwner(prompt)) }),
        ...request,
      }),
    );
  }).pipe(Effect.scoped);
  return {
    directory,
    effect,
    events,
    log,
  };
};

describe("running a thread on the Muse harness", () => {
  it.live("completes a turn with its reply, usage, and the context gauge Muse reports", () => {
    const { directory, effect, events, log } = runScenario("basic", { text: "Hello" });
    return Effect.gen(function* () {
      const outcome = yield* effect;
      expect(outcome.isInterrupted).toBe(false);
      expect(outcome.sessionId).toMatch(/^s-1-/);
      expect(outcome.usage).toEqual({ cacheCreation: 0, cacheRead: 0, input: 120, output: 10 });
      expect(outcome.context).toBe(144);
      expect(outcome.contextWindow).toBe(1000);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual(["Hello from Muse"]);
      expect(events.filter((event) => event._tag === "Draft").map((event) => event.text)).toEqual(["Hello from Muse"]);
      expect(events.some((event) => event._tag === "Notice")).toBe(false);
      // The session starts asking before acting, with Outlore's own tool server bridged in.
      const start = readEntries(log).find((entry) => entry.method === "session/start")?.params;
      expect(start?.approvalMode).toBe("promptUnmatched");
      expect((start?.config as Record<string, unknown> | undefined)?.mcpServers).toEqual({
        outlore: { transport: "streamableHttp", url: "http://127.0.0.1:9/mcp/none" },
      });
      expect((start?.config as Record<string, unknown> | undefined)?.developerPrompt).toBe("Starting context.");
      expect((start?.workspaceRoot as string | undefined) ?? "").toMatch(/^\//);
      const turn = readEntries(log).find((entry) => entry.method === "turn/start")?.params;
      expect((turn?.input as Array<{ text?: string }> | undefined)?.[0]).toEqual({ text: "Hello", type: "text" });
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("selects the qualified model with its provider and the reasoning effort by name", () => {
    const { directory, effect, log } = runScenario("basic", {
      effort: "high",
      model: "fake-lab/muse-one",
      text: "Hello",
    });
    return Effect.gen(function* () {
      yield* effect;
      const start = readEntries(log).find((entry) => entry.method === "session/start")?.params;
      expect([start?.modelId, start?.providerId]).toEqual(["muse-one", "fake-lab"]);
      const effort = readEntries(log).find((entry) => entry.method === "session/setReasoningEffort")?.params;
      expect(effort?.reasoningEffort).toBe("high");
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("continues the session the host kept, without starting a new one", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-muse-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf("basic", log, { MUSE_FAKE_RESUMABLE: "known-id" });
      const outcome = yield* harness.runTurn(turnRequestOf({ sessionId: "known-id", text: "Hello" }));
      expect(outcome.sessionId).toBe("known-id");
      expect(readEntries(log).some((entry) => entry.method === "session/start")).toBe(false);
      expect(readEntries(log).some((entry) => entry.method === "session/resume")).toBe(true);
      // The turn's message never repeats the starting context: that lives in the session's developer prompt.
      const turn = readEntries(log).find((entry) => entry.method === "turn/start")?.params;
      expect((turn?.input as Array<{ text?: string }> | undefined)?.[0]?.text).toBe("Hello");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("replaces a session Muse could not load, visibly and with the thread's history", () => {
    const { directory, effect, events, log } = runScenario("basic", {
      conversationSoFar: Effect.succeed("Earlier words."),
      sessionId: "gone",
      text: "Hello",
    });
    return Effect.gen(function* () {
      const outcome = yield* effect;
      expect(outcome.sessionId).toMatch(/^s-1-/);
      expect(events.some((event) => event._tag === "Notice" && event.text.includes("earlier conversation"))).toBe(true);
      const turn = readEntries(log).find((entry) => entry.method === "turn/start")?.params;
      expect((turn?.input as Array<{ text?: string }> | undefined)?.[0]?.text).toBe("Earlier words.\n\nHello");
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("asks the owner about a tool call and grants only the once-scoped approval", () => {
    const decision = answersOf(true);
    const { directory, effect, events, log } = {
      ...runScenario("approval", { text: "run it" }, decision.answer),
    };
    return Effect.gen(function* () {
      const outcome = yield* effect;
      expect(outcome.isInterrupted).toBe(false);
      expect(decision.prompts.map((prompt) => [prompt.toolName, prompt.input])).toEqual([
        ["run_command", { command: "echo hi" }],
      ]);
      const decide = readEntries(log).find((entry) => entry.method === "approval/decide")?.params;
      expect(decide?.choiceId).toBe("allow-once");
      expect(events.some((event) => event._tag === "ToolCall" && event.toolName === "run_command")).toBe(true);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual(["Allowed answer"]);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("refuses a tool call by the deny the request offered", () => {
    const decision = answersOf(false);
    const { directory, effect, events, log } = runScenario("approval", { text: "run it" }, decision.answer);
    return Effect.gen(function* () {
      yield* effect;
      const decide = readEntries(log).find((entry) => entry.method === "approval/decide")?.params;
      expect(decide?.choiceId).toBe("deny-once");
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual(["Denied answer"]);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("stops the turn an approval no offered choice can close, rather than guess", () => {
    const decision = answersOf(false);
    const { directory, effect, log } = runScenario("unmediatable", { text: "run it" }, decision.answer);
    return Effect.gen(function* () {
      const failure = yield* Effect.flip(effect);
      expect(failure.reason).toContain("offered no once-scoped approval");
      expect(failure.reason).toContain("nor any deny");
      // Nothing was decided behind the owner's back, and the turn was stopped on the interrupt lane.
      expect(readEntries(log).some((entry) => entry.method === "approval/decide")).toBe(false);
      expect(readEntries(log).some((entry) => entry.method === "turn/interrupt")).toBe(true);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("splices the events a dropped update lost through view/page", () => {
    const { directory, effect, events, log } = runScenario("gap", { text: "Hello" });
    return Effect.gen(function* () {
      const outcome = yield* effect;
      expect(outcome.isInterrupted).toBe(false);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual(["Recovered whole"]);
      expect(events.filter((event) => event._tag === "Draft").map((event) => event.text)).toEqual(["Recovered whole"]);
      expect(readEntries(log).filter((entry) => entry.method === "view/page").length).toBeGreaterThanOrEqual(2);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("carries the turn on past a malformed host line, on a Notice the thread shows", () => {
    const { directory, effect, events } = runScenario("malformed", { text: "Hello" });
    return Effect.gen(function* () {
      const outcome = yield* effect;
      expect(outcome.isInterrupted).toBe(false);
      expect(outcome.sessionId).toMatch(/^s-1-/);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual(["Hello from Muse"]);
      expect(events.some((event) => event._tag === "Notice")).toBe(true);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("ends the turn as interrupted when the owner interrupts mid-approval", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-muse-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf("approval", log);
      // The owner never decides, as an away owner would not.
      const fiber = yield* Effect.forkChild(
        harness.runTurn(turnRequestOf({ askOwner: () => Effect.never, text: "run it" })),
      );
      yield* untilLogged(log, (entry) => entry.method === "turn/start");
      expect(yield* harness.interrupt("thread-1")).toBe(true);
      const outcome = yield* Fiber.join(fiber);
      expect(outcome.isInterrupted).toBe(true);
      // The owner never decided, and nothing was decided for them.
      expect(readEntries(log).some((entry) => entry.method === "approval/decide")).toBe(false);
      expect(readEntries(log).some((entry) => entry.method === "turn/interrupt")).toBe(true);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("takes a steered message into the running turn, reporting it delivered", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-muse-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf("steer", log);
      const fiber = yield* Effect.forkChild(
        harness.runTurn(
          turnRequestOf({
            onEvent: (event) => Effect.sync(() => events.push(event)),
            text: "Hello",
          }),
        ),
      );
      yield* Effect.promise(async () => {
        for (let attempt = 0; attempt < 250; attempt += 1) {
          if (events.some((event) => event._tag === "Draft")) return;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      });
      const isTaken = yield* harness.steer("thread-1", { id: "steer-1", images: [], text: "And more" });
      expect(isTaken).toBe(true);
      const outcome = yield* Fiber.join(fiber);
      expect(outcome.isInterrupted).toBe(false);
      expect(events.some((event) => event._tag === "Delivered" && event.messageId === "steer-1")).toBe(true);
      const turn = readEntries(log).find((entry) => entry.method === "turn/steer")?.params;
      expect((turn?.input as Array<{ text?: string }> | undefined)?.[0]?.text).toBe("And more");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });
});
