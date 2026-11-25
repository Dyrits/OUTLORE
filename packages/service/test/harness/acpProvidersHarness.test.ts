import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { singleVarIsolation } from "../../src/harness/accountIsolation.ts";
import { bridgeNodePathOf } from "../../src/harness/acpMcpBridge.ts";
import { makeAcpProviderHarness } from "../../src/harness/acpProviders.ts";
import {
  type AcpFakeConfig,
  acpFakeDefinition,
  acpFakeEnv,
  acpFakeRequest,
  acpFakeScript,
  configSetsLogged,
  readAcpFakeLog,
  untilAcpFakeLogged,
} from "../fixtures/acpFake.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the generic ACP provider turn adapter against the one configurable ACP stand-in, `acpFake.mjs`.

/** The session the generic adapter's checks open: it offers an ask mode, a model and a thinking level. */
const turnSession = { modes: ["ask", "default"], options: ["model", "thinking"], usage: "update" } as const;

const harnessOf = (log: string, config: AcpFakeConfig = {}) =>
  makeAcpProviderHarness({
    command: process.execPath,
    definition: acpFakeDefinition({ spawnEnv: acpFakeEnv(log, { ...turnSession, ...config }) }),
    idleTimeout: "10 minutes",
    prefixArgs: [acpFakeScript],
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
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("gives the session an HTTP MCP server when supported and the stdio bridge otherwise", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const bridgePath = join(import.meta.dirname, "../../src/harness/acpMcpBridge.mjs");
    const sessionParamsOf = (config: AcpFakeConfig, mcpUrl = "http://127.0.0.1:9/mcp/none") =>
      Effect.gen(function* () {
        const log = join(directory, `calls-${JSON.stringify(config).length}-${mcpUrl.length}`);
        const harness = yield* harnessOf(log, config);
        const base = turnRequestOf({ text: "hello" });
        yield* harness.runTurn({ ...base, access: { ...base.access, mcpUrl } });
        return acpFakeRequest(log, "session/new").params?.mcpServers;
      });
    return Effect.gen(function* () {
      expect(yield* sessionParamsOf({})).toEqual([
        {
          args: [bridgePath, "http://127.0.0.1:9/mcp/none"],
          command: bridgeNodePathOf(),
          env: [],
          name: "outlore",
        },
      ]);
      expect(yield* sessionParamsOf({ mcpHttp: true })).toEqual([
        { headers: [], name: "outlore", type: "http", url: "http://127.0.0.1:9/mcp/none" },
      ]);
      expect(yield* sessionParamsOf({}, "")).toEqual([]);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("tells a session with no tool server that the thread tools are unavailable, and one with it nothing", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const promptTextOf = (config: AcpFakeConfig, mcpUrl = "http://127.0.0.1:9/mcp/none") =>
      Effect.gen(function* () {
        const log = join(directory, `calls-${JSON.stringify(config).length}-${mcpUrl.length}`);
        const harness = yield* harnessOf(log, config);
        const base = turnRequestOf({ context: "Starting context.", text: "hello" });
        yield* harness.runTurn({ ...base, access: { ...base.access, mcpUrl } });
        const prompt = acpFakeRequest(log, "session/prompt");
        return JSON.stringify(prompt?.params?.prompt);
      });
    return Effect.gen(function* () {
      const without = yield* promptTextOf({}, "");
      expect(without).toContain("Starting context.");
      expect(without).toContain("has no Outlore tool server");
      expect(without).toContain("request_approval");
      expect(yield* promptTextOf({})).not.toContain("tool server");
      expect(yield* promptTextOf({ mcpHttp: true })).not.toContain("tool server");
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
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
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("starts a new session with the thread's conversation when the old one is missing", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, { missingSession: "gone" });
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
      const prompt = acpFakeRequest(log, "session/prompt");
      const text = ((prompt?.params?.prompt as Array<{ text?: string }> | undefined) ?? []).map(
        (part) => part.text ?? "",
      )[0];
      expect(text).toContain("Earlier words.");
      expect(text).toContain("Starting context.");
      expect(text).toContain("Two");
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("ends the turn as interrupted when the running turn is interrupted", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, { slow: true });
      const fiber = yield* Effect.forkChild(harness.runTurn(turnRequestOf({ text: "slow" })));
      yield* untilAcpFakeLogged(log, (entry) => entry.method === "session/prompt");
      expect(yield* harness.interrupt("thread-1")).toBe(true);
      const outcome = yield* Fiber.join(fiber);
      expect(outcome.isInterrupted).toBe(true);
      expect(readAcpFakeLog(log).some((entry) => entry.method === "session/cancel")).toBe(true);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("refuses to start a configured-state provider without its account folder", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* makeAcpProviderHarness({
        command: process.execPath,
        definition: acpFakeDefinition({
          isolation: singleVarIsolation("HERMES_HOME", true),
          label: "fake Hermes",
          spawnEnv: acpFakeEnv(log, turnSession),
        }),
        idleTimeout: "10 minutes",
        prefixArgs: [acpFakeScript],
      });
      // No account folder to run as the state home (configDirectory stays null in turnRequestOf).
      const failure = yield* harness.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      expect(failure.reason).toContain("fake Hermes runs against the account folder");
      // Without an account folder the provider would reach for the user's own home, so nothing started.
      expect(existsSync(log)).toBe(false);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });

  it.live("runs the account folder as the state home and sets only the ask mode, model, and thinking", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-acp-turn-"));
    const log = join(directory, "calls");
    const account = join(directory, "account");
    return Effect.gen(function* () {
      const harness = yield* makeAcpProviderHarness({
        command: process.execPath,
        definition: acpFakeDefinition({
          isolation: singleVarIsolation("KIMI_CODE_HOME"),
          label: "fake Kimi",
          spawnEnv: acpFakeEnv(log, { ...turnSession, logEnv: ["KIMI_CODE_HOME"] }),
        }),
        idleTimeout: "10 minutes",
        prefixArgs: [acpFakeScript],
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
      expect(acpFakeRequest(log, "session/new").launch?.env.KIMI_CODE_HOME).toBe(account);
      const set = configSetsLogged(log);
      expect(set).toContainEqual(["mode", "ask"]);
      expect(set).toContainEqual(["model", "model-a"]);
      expect(set).toContainEqual(["thinking", "high"]);
    }).pipe(
      Effect.scoped,
      Effect.ensuring(
        Effect.sync(() => rmSync(directory, { force: true, maxRetries: 5, recursive: true, retryDelay: 50 })),
      ),
    );
  });
});
