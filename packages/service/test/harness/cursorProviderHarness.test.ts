import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { makeCursorProviderHarness, probeCursorModels } from "../../src/harness/cursorProvider.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the Cursor harness against its stand-in, `cursorProviderFake.mjs`: the audited launch
// (`acp`), a mediated tool permission, the model set through the session's config options, Cursor's
// stdout noise line tolerated by the line transport, the fail-closed answer to a reverse request Outlore
// does not mediate, and the model probe — all against the profile registration will pass.

type LoggedEntry = {
  args?: Array<string>;
  configId?: string;
  method?: string;
  setConfigOption?: boolean;
  strictAnswer?: string;
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

const harnessOf = (log: string, env: Record<string, string> = {}) =>
  makeCursorProviderHarness({
    command: process.execPath,
    env: { CURSOR_FAKE_LOG: log, CURSOR_FAKE_MODE: "turn", ...env },
    idleTimeout: "10 minutes",
    prefixArgs: [join(import.meta.dirname, "../fixtures/cursorProviderFake.mjs")],
  });

describe("running a thread on the Cursor harness", () => {
  it.live("launches cursor-agent acp, sets the picked model, and mediates a permission the owner allows", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cursor-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          model: "gpt-5.2",
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "run git push",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      // Cursor reports no usage over ACP, so a plain turn reports none.
      expect(outcome.usage).toEqual({ cacheCreation: 0, cacheRead: 0, input: 0, output: 0 });
      const entries = readEntries(log);
      expect(entries[0]?.args).toEqual(["acp"]);
      const setOptions = entries.filter((entry) => entry.setConfigOption === true);
      expect(setOptions).toEqual([{ configId: "model", setConfigOption: true, value: "gpt-5.2" }]);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "tool was allow_once",
      ]);
      expect(events).toContainEqual({
        _tag: "ToolCall",
        id: "cursor-call-1",
        input: { command: "git push origin main" },
        toolName: "git push origin main",
      });
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("answers a denial with the provider's reject option and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cursor-turn-"));
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

  it.live("refuses a reverse request Outlore does not mediate, and tolerates the CLI's stdout noise", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cursor-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, { CURSOR_FAKE_STRICT: "1" });
      const outcome = yield* harness.runTurn(turnRequestOf({ text: "strict" }));
      expect(outcome.isInterrupted).toBe(false);
      yield* untilLogged(log, (entry) => entry.strictAnswer !== undefined);
      expect(readEntries(log).find((entry) => entry.strictAnswer !== undefined)?.strictAnswer).toBe(
        "Outlore does not answer session/set_mode.",
      );
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("probes the models the session offers", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cursor-probe-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const models = yield* probeCursorModels({
        command: process.execPath,
        env: { CURSOR_FAKE_LOG: log, CURSOR_FAKE_MODE: "probe" },
        prefixArgs: [join(import.meta.dirname, "../fixtures/cursorProviderFake.mjs")],
      });
      expect(models).toEqual([
        { id: "cursor/composer-1", label: "Cursor Composer" },
        { id: "gpt-5.2", label: "GPT-5.2" },
      ]);
      expect(readEntries(log)[0]?.args).toEqual(["acp"]);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });
});
