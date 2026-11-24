import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { cursor } from "../../src/harness/cursorProvider.ts";
import {
  type AcpFakeConfig,
  acpFakeEnv,
  acpFakeScript,
  configSetsLogged,
  readAcpFakeLog,
  untilAcpFakeLogged,
} from "../fixtures/acpFake.ts";
import { standInHarness, standInProbe } from "../fixtures/providerStandIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the Cursor harness against the one configurable ACP stand-in, `acpFake.mjs`: the audited launch
// (`acp`), a mediated tool permission, the model set through the session's config options, Cursor's
// stdout noise line tolerated by the line transport, the fail-closed answer to a reverse request Outlore
// does not mediate, and the model probe — all against the profile registration will pass.

const models = [
  ["Cursor Composer", "cursor/composer-1"],
  ["GPT-5.2", "gpt-5.2"],
] as const;
/** Cursor's own tool call: a command whose title is the command line. */
const command = {
  id: "cursor-call-1",
  title: "git push origin main",
} as const;

const harnessOf = (log: string, config: AcpFakeConfig = {}) =>
  standInHarness("cursor", {
    command: process.execPath,
    env: acpFakeEnv(log, { models, noise: true, options: ["model", "thinking"], tool: command, ...config }),
    idleTimeout: "10 minutes",
    prefixArgs: [acpFakeScript],
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
      expect(readAcpFakeLog(log)[0]?.launch?.argv).toEqual(["acp"]);
      expect(configSetsLogged(log)).toEqual([["model", "gpt-5.2"]]);
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
      const harness = yield* harnessOf(log, { strict: true });
      const outcome = yield* harness.runTurn(turnRequestOf({ text: "strict" }));
      expect(outcome.isInterrupted).toBe(false);
      yield* untilAcpFakeLogged(log, (entry) => entry.strictAnswer !== undefined);
      expect(readAcpFakeLog(log).find((entry) => entry.strictAnswer !== undefined)?.strictAnswer).toBe(
        "Outlore does not answer session/set_mode.",
      );
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("probes the models the session offers", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-cursor-probe-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const offered = yield* standInProbe(cursor, {
        command: process.execPath,
        env: acpFakeEnv(log, { mode: "probe", models }),
        prefixArgs: [acpFakeScript],
      });
      expect(offered).toEqual([
        { id: "cursor/composer-1", label: "Cursor Composer" },
        { id: "gpt-5.2", label: "GPT-5.2" },
      ]);
      expect(readAcpFakeLog(log)[0]?.launch?.argv).toEqual(["acp"]);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });
});
