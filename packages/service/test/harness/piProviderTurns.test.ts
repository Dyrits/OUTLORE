import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import type { PiProvider } from "../../src/harness/pi.ts";
import { makePiHarness } from "../../src/harness/pi.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the Pi harness (`makePiHarness`) against its stand-in, `piProviderFake.mjs` in turn mode: one kept
// process a thread, turns completed by `agent_settled`, cancel as `clear_queue` then `abort`, sessions continued
// by file, and every Pi tool source denied (fail-closed, piTools.ts).

type LoggedEntry = {
  cancelled?: boolean;
  configDirectory?: string | null;
  level?: string;
  message?: string;
  method?: string;
  modelId?: string;
  provider?: string;
  session?: string | null;
  sessionFile?: string;
  toolName?: string;
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

const harnessOf = (env: Record<string, string> = {}, provider: PiProvider = "pi") =>
  makePiHarness({
    command: process.execPath,
    env: { PI_FAKE_MODE: "turn", ...env },
    idleTimeout: "10 minutes",
    prefixArgs: [join(import.meta.dirname, "../fixtures/piProviderFake.mjs")],
    provider,
  });

describe("running a thread on the Pi harness", () => {
  it.live("completes a turn at agent_settled and reports its session and usage", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log });
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          effort: "high",
          model: "deepseek/deepseek-chat",
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "Hello",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(outcome.sessionId).toBe("pi-1");
      expect(outcome.usage).toEqual({ cacheCreation: 1, cacheRead: 2, input: 10, output: 5 });
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Hello from the Pi stand-in.",
      ]);
      expect(events.filter((event) => event._tag === "Draft").map((event) => event.text)).toEqual([
        "Hello from the Pi stand-in.",
      ]);
      expect(events.some((event) => event._tag === "Notice")).toBe(false);
      // The qualified picker id is split back into the upstream provider and the model id for `set_model`.
      const setModel = readEntries(log).find((entry) => entry.method === "set_model");
      expect([setModel?.provider, setModel?.modelId]).toEqual(["deepseek", "deepseek-chat"]);
      expect(readEntries(log).find((entry) => entry.method === "set_thinking_level")?.level).toBe("high");
      const prompt = readEntries(log).find((entry) => entry.method === "prompt");
      // A fresh session's first prompt carries the starting context before the turn's message.
      expect(prompt?.message).toBe("Starting context.\n\nHello");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("sends a dedicated provider's model id unchanged", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log }, "deepseek");
      const outcome = yield* harness.runTurn(turnRequestOf({ model: "deepseek-chat", text: "Hello" }));
      expect(outcome.sessionId).toBe("pi-1");
      const setModel = readEntries(log).find((entry) => entry.method === "set_model");
      expect([setModel?.provider, setModel?.modelId]).toEqual(["deepseek", "deepseek-chat"]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("continues the thread's session file and the process it started", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log });
      // A second turn on the same thread reuses the kept process: no second start, the same session continued.
      const first = yield* harness.runTurn(turnRequestOf({ text: "One" }));
      const second = yield* harness.runTurn(
        turnRequestOf({
          onEvent: (event) => Effect.sync(() => events.push(event)),
          sessionId: first.sessionId,
          text: "Two",
        }),
      );
      expect(second.sessionId).toBe(first.sessionId);
      expect(readEntries(log).filter((entry) => entry.method === "start")).toHaveLength(1);
      const prompt = readEntries(log).filter((entry) => entry.method === "prompt");
      expect(prompt.map(({ message }) => message)).toEqual(["Starting context.\n\nOne", "Two"]);
      // A fresh process on a session file Pi can continue: the start argument carries the session, no notice.
      const resumed = yield* harness.runTurn(
        turnRequestOf({ sessionId: first.sessionId, text: "Three", threadId: "thread-2" }),
      );
      expect(resumed.sessionId).toBe(first.sessionId);
      expect(events.some((event) => event._tag === "Notice")).toBe(false);
      expect(readEntries(log).find((entry) => entry.method === "get_state")?.sessionFile).toBe(first.sessionId);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("replaces a session Pi could not continue, visibly", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log, PI_FAKE_MISSING_SESSION: "gone", PI_FAKE_SESSION: "pi-2" });
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          conversationSoFar: Effect.succeed("Earlier words."),
          onEvent: (event) => Effect.sync(() => events.push(event)),
          sessionId: "gone",
          text: "Hello",
        }),
      );
      expect(outcome.sessionId).toBe("pi-2");
      expect(events.some((event) => event._tag === "Notice" && event.text.includes("gone"))).toBe(true);
      // The replaced session opens with the thread's conversation carried over, before this turn's message.
      expect(readEntries(log).find((entry) => entry.method === "prompt")?.message).toBe("Earlier words.\n\nHello");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("ends the turn as interrupted through clear_queue then abort", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log, PI_FAKE_SLOW: "5000" });
      const fiber = yield* Effect.forkChild(harness.runTurn(turnRequestOf({ text: "slow" })));
      yield* untilLogged(log, (entry) => entry.method === "prompt");
      expect(yield* harness.interrupt("thread-1")).toBe(true);
      const outcome = yield* Fiber.join(fiber);
      expect(outcome.isInterrupted).toBe(true);
      const methods = readEntries(log).map((entry) => entry.method);
      expect(methods.indexOf("clear_queue")).toBeGreaterThanOrEqual(0);
      expect(methods.indexOf("clear_queue")).toBeLessThan(methods.indexOf("abort"));
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("fails a turn whose prompt Pi refused, and runs no further request", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log, PI_FAKE_REFUSE_PROMPT: "1" });
      const failure = yield* harness.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      expect(failure.reason).toContain("already running");
      // The turn never started, so nothing but the refusal was asked of Pi.
      expect(readEntries(log).some((entry) => entry.method === "clear_queue")).toBe(false);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("denies a question Pi asks the owner and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log, PI_FAKE_UI_QUESTION: "1" });
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "Hello",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(events.some((event) => event._tag === "Reply")).toBe(true);
      const denied = readEntries(log).find((entry) => entry.method === "extension_ui_response");
      expect(denied?.cancelled).toBe(true);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("ends a turn in which Pi ran a tool despite the denial flags", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log, PI_FAKE_TOOL_BREACH: "1" });
      const failure = yield* harness.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      expect(failure.reason).toContain('"shell"');
      expect(failure.reason).toContain("denied");
      expect(readEntries(log).some((entry) => entry.method === "tool_breach")).toBe(true);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("runs the account's config directory as Pi's own state directory", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    const account = join(directory, "account");
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log });
      const outcome = yield* harness.runTurn(turnRequestOf({ configDirectory: account, text: "Hello" }));
      expect(outcome.sessionId).toBe("pi-1");
      const started = readEntries(log).find((entry) => entry.method === "start");
      expect(started?.configDirectory).toBe(account);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("takes no image attachments", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-pi-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf({ PI_FAKE_LOG: log });
      const failure = yield* harness
        .runTurn(
          turnRequestOf({ images: [{ mediaType: "image/png", name: "one.png", path: "/tmp/one.png" }], text: "Hello" }),
        )
        .pipe(Effect.flip);
      expect(failure.reason).toContain("no image attachments");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });
});
