import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { cline } from "../../src/harness/clineProvider.ts";
import { standInHarness, standInProbe } from "../fixtures/providerStandIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Fixture checks of the Cline harness against its stand-in, clineProviderFake.mjs: the launch carries the pinned argv
// and environment (the local session backend and the CLI's self-update suppression), and a turn mediates its tool calls through the owner exactly as the generic ACP adapter does.

type LoggedEntry = {
  argv?: string[];
  autoUpdateDisabled?: string | null;
  backendMode?: string | null;
  method?: string;
  params?: Record<string, unknown>;
};

const readEntries = (log: string): Array<LoggedEntry> =>
  readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => JSON.parse(line) as LoggedEntry);

/** The stand-in's entry for one method, or a failure naming the absent method. */
const entryOf = (log: string, method: string) => {
  const entry = readEntries(log).find((parsed) => parsed.method === method);
  if (entry === undefined) throw new Error(`the stand-in logged no ${method}`);
  return entry;
};

const fakeArgs = ["../fixtures/clineProviderFake.mjs"] as const;

const probeOf = (log: string) =>
  standInProbe(cline, {
    command: "node",
    env: { CLINE_FAKE_LOG: log },
    prefixArgs: [join(import.meta.dirname, fakeArgs[0])],
  }).pipe(Effect.runPromise);

describe("probing the cline CLI", () => {
  it("reads the session's models with the pinned argv and environment", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cline-probe-"));
    const log = join(directory, "calls");
    try {
      const models = await probeOf(log);
      expect(models).toEqual([{ id: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = entryOf(log, "session/new");
      expect(entry.argv).toEqual(["--acp"]);
      expect(entry.backendMode).toBe("local");
      expect(entry.autoUpdateDisabled).toBe("1");
      expect(entry.params?.mcpServers).toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});

describe("running a thread on the cline CLI", () => {
  const harnessOf = (log: string) =>
    standInHarness(cline, {
      command: "node",
      env: { CLINE_FAKE_LOG: log, CLINE_FAKE_MODE: "turn" },
      idleTimeout: "10 minutes",
      prefixArgs: [join(import.meta.dirname, fakeArgs[0])],
    });

  it.live("mediates a tool permission request the owner allows", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cline-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({ onEvent: (event) => Effect.sync(() => events.push(event)), text: "run git push" }),
      );
      expect(outcome.isInterrupted).toBe(false);
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
      const entry = entryOf(log, "session/prompt");
      expect(entry.argv).toEqual(["--acp"]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("answers a denial with the provider's reject option and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cline-turn-"));
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
});
