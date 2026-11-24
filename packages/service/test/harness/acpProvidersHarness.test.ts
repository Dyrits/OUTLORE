import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { makeAcpProviderHarness } from "../../src/harness/acpProviders.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the generic ACP provider turn adapter against its stand-in, `acpProvidersFake.mjs` in turn mode.

type LoggedEntry = { cwd?: string; kimiCodeHome?: string | null; method?: string; params?: Record<string, unknown> };

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

const harnessOf = (log: string, env: Record<string, string> = {}) =>
  makeAcpProviderHarness({
    command: process.execPath,
    idleTimeout: "10 minutes",
    prefixArgs: [join(import.meta.dirname, "../fixtures/acpProvidersFake.mjs")],
    profile: { args: [], env: { ACP_FAKE_LOG: log, ACP_FAKE_MODE: "turn", ...env }, label: "fake ACP" },
  });

describe("running a thread on a generic ACP provider", () => {
  it.live("mediates a tool permission request the owner allows, then reports the turn's usage", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({ onEvent: (event) => Effect.sync(() => events.push(event)), text: "run git push" }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(outcome.billing).toBe("Unknown");
      expect(outcome.usage).toEqual({ cacheCreation: 0, cacheRead: 2, input: 10, output: 5 });
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "tool was allow_once",
      ]);
      expect(events).toContainEqual({
        _tag: "ToolCall",
        id: "call-1",
        input: { command: "git push origin main" },
        toolName: "git push",
      });
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("gives the session the thread's tool server only when the agent takes HTTP MCP servers", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const sessionParamsOf = (env: Record<string, string>) =>
      Effect.gen(function* () {
        const log = join(directory, `calls-${Object.keys(env).length}`);
        const harness = yield* harnessOf(log, env);
        yield* harness.runTurn(turnRequestOf({ text: "hello" }));
        return readEntries(log).find((entry) => entry.method === "session/new")?.params?.mcpServers;
      });
    return Effect.gen(function* () {
      expect(yield* sessionParamsOf({})).toEqual([]);
      expect(yield* sessionParamsOf({ ACP_FAKE_MCP_HTTP: "1" })).toEqual([
        { headers: [], name: "outlore", type: "http", url: "http://127.0.0.1:9/mcp/none" },
      ]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("tells a session with no tool server that the thread tools are unavailable, and one with it nothing", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const promptTextOf = (env: Record<string, string>) =>
      Effect.gen(function* () {
        const log = join(directory, `calls-${Object.keys(env).length}`);
        const harness = yield* harnessOf(log, env);
        yield* harness.runTurn(turnRequestOf({ context: "Starting context.", text: "hello" }));
        const prompt = readEntries(log).find((entry) => entry.method === "session/prompt");
        return JSON.stringify(prompt?.params?.prompt);
      });
    return Effect.gen(function* () {
      const without = yield* promptTextOf({});
      expect(without).toContain("Starting context.");
      expect(without).toContain("has no Outlore tool server");
      expect(without).toContain("request_approval");
      expect(yield* promptTextOf({ ACP_FAKE_MCP_HTTP: "1" })).not.toContain("tool server");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("answers a denial with the provider's reject option and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          askOwner: () => Effect.succeed({ isAllowed: false, text: "" }),
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "run git push",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "tool was reject_once",
      ]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("starts a new session with the thread's conversation when the old one is missing", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, { ACP_FAKE_MISSING_SESSION: "gone" });
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          conversationSoFar: Effect.succeed("Earlier words."),
          onEvent: (event) => Effect.sync(() => events.push(event)),
          sessionId: "gone",
          text: "Two",
        }),
      );
      expect(outcome.sessionId).toBe("acp-1");
      expect(events.some((event) => event._tag === "Notice" && event.text.includes("could not pick up"))).toBe(true);
      const prompt = readEntries(log).find((entry) => entry.method === "session/prompt");
      const text = ((prompt?.params?.prompt as Array<{ text?: string }> | undefined) ?? []).map(
        (part) => part.text ?? "",
      )[0];
      expect(text).toContain("Earlier words.");
      expect(text).toContain("Starting context.");
      expect(text).toContain("Two");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("ends the turn as interrupted when the running turn is interrupted", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, { ACP_FAKE_SLOW: "1" });
      const fiber = yield* Effect.forkChild(harness.runTurn(turnRequestOf({ text: "slow" })));
      yield* untilLogged(log, (entry) => entry.method === "session/prompt");
      expect(yield* harness.interrupt("thread-1")).toBe(true);
      const outcome = yield* Fiber.join(fiber);
      expect(outcome.isInterrupted).toBe(true);
      expect(readEntries(log).some((entry) => entry.method === "session/cancel")).toBe(true);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("refuses to start a configured-state provider without its account folder", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* makeAcpProviderHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: [join(import.meta.dirname, "../fixtures/acpProvidersFake.mjs")],
        profile: {
          args: [],
          env: { ACP_FAKE_LOG: log, ACP_FAKE_MODE: "turn" },
          label: "fake Hermes",
          needsConfiguredStateHome: true,
          stateHomeEnv: "HERMES_HOME",
        },
      });
      // No account folder to run as the state home (configDirectory stays null in turnRequestOf).
      const failure = yield* harness.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      expect(failure.reason).toContain("HERMES_HOME");
      // Without an account folder the provider would reach for the user's own home, so nothing started.
      expect(existsSync(log)).toBe(false);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("runs the account folder as the state home and sets only the ask mode, model, and thinking", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    const account = join(directory, "account");
    return Effect.gen(function* () {
      const harness = yield* makeAcpProviderHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: [join(import.meta.dirname, "../fixtures/acpProvidersFake.mjs")],
        profile: {
          args: [],
          env: { ACP_FAKE_LOG: log, ACP_FAKE_MODE: "turn" },
          label: "fake Kimi",
          stateHomeEnv: "KIMI_CODE_HOME",
        },
      });
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          configDirectory: account,
          effort: "high",
          model: "model-a",
          text: "Hello",
        }),
      );
      expect(outcome.sessionId).toBe("acp-1");
      const created = readEntries(log).find((entry) => entry.method === "session/new");
      expect(created?.kimiCodeHome).toBe(account);
      const set = readEntries(log)
        .filter((entry) => entry.method === "session/set_config_option")
        .map((entry) => [entry.params?.configId, entry.params?.value]);
      expect(set).toContainEqual(["mode", "ask"]);
      expect(set).toContainEqual(["model", "model-a"]);
      expect(set).toContainEqual(["thinking", "high"]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });
});
