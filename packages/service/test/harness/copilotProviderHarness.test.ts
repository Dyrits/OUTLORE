import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { makeCopilotProviderHarness, probeCopilotModels } from "../../src/harness/copilotProvider.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Checks of the Copilot harness against its stand-in, `copilotProviderFake.mjs`: the audited launch
// (`--acp --no-auto-update` with `COPILOT_AUTO_UPDATE=false`), a mediated edit permission, the -32000
// answer of a signed-out process, the CLI's own plan-used-up failure text, and the model probe — all
// against the profile registration will pass.

type LoggedEntry = { args?: Array<string>; autoUpdate?: string | null; method?: string };

const readEntries = (log: string): Array<LoggedEntry> =>
  existsSync(log)
    ? readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .filter((line) => line !== "")
        .map((line) => JSON.parse(line) as LoggedEntry)
    : [];

const harnessOf = (log: string, env: Record<string, string> = {}) =>
  makeCopilotProviderHarness({
    command: process.execPath,
    env: { COPILOT_FAKE_LOG: log, COPILOT_FAKE_MODE: "turn", ...env },
    idleTimeout: "10 minutes",
    prefixArgs: [join(import.meta.dirname, "../fixtures/copilotProviderFake.mjs")],
  });

describe("running a thread on the Copilot harness", () => {
  it.live("launches copilot --acp with its update squeeze, and mediates a permission the owner allows", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-copilot-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "edit src/index.ts",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      const entries = readEntries(log);
      expect(entries[0]?.args).toEqual(["--acp", "--no-auto-update"]);
      expect(entries[0]?.autoUpdate).toBe("false");
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "edit was allow_once",
      ]);
      expect(events).toContainEqual({
        _tag: "ToolCall",
        id: "copilot-call-1",
        input: { path: "src/index.ts" },
        toolName: "Edit src/index.ts",
      });
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("answers a denial with the provider's reject option and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-copilot-turn-"));
    const log = join(directory, "calls");
    const events: Array<HarnessEvent> = [];
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log);
      const outcome = yield* harness.runTurn(
        turnRequestOf({
          askOwner: () => Effect.succeed({ isAllowed: false, text: "" }),
          onEvent: (event) => Effect.sync(() => events.push(event)),
          text: "edit src/index.ts",
        }),
      );
      expect(outcome.isInterrupted).toBe(false);
      expect(events.filter((event) => event._tag === "Reply").map((event) => event.text)).toEqual([
        "Working",
        "edit was reject_once",
      ]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("fails a signed-out process by the CLI's own -32000 session answer", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-copilot-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, { COPILOT_FAKE_SIGNED_OUT: "1" });
      const failure = yield* harness.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      expect(failure.code).toBe(-32000);
      expect(failure.reason).toContain("not signed in to GitHub Copilot");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("carries the CLI's plan-used-up error as the turn's failure", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-copilot-turn-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const harness = yield* harnessOf(log, { COPILOT_FAKE_PLAN_USED_UP: "1" });
      const failure = yield* harness.runTurn(turnRequestOf({ text: "Hello" })).pipe(Effect.flip);
      expect(failure.reason).toContain("Add a payment method to continue.");
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("probes the models a signed-in session offers, and fails a signed-out probe by -32000", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-copilot-probe-"));
    const log = join(directory, "calls");
    return Effect.gen(function* () {
      const probe = (env: Record<string, string>) =>
        probeCopilotModels({
          command: process.execPath,
          env: { COPILOT_FAKE_LOG: log, COPILOT_FAKE_MODE: "probe", ...env },
          prefixArgs: [join(import.meta.dirname, "../fixtures/copilotProviderFake.mjs")],
        });
      const models = yield* probe({});
      expect(models).toEqual([
        { id: "gpt-5.2", label: "GPT-5.2" },
        { id: "claude-opus-4.6", label: "Claude Opus 4.6" },
      ]);
      const failure = yield* probe({ COPILOT_FAKE_SIGNED_OUT: "1" }).pipe(Effect.flip);
      // A signed-out probe surfaces the same answer the start does (-32000); the probe closes over one
      // HarnessFailure shape, so registration reads its failure as "not signed in".
      expect(failure.reason).toContain("did not answer session/new in time");
      expect(readEntries(log)[0]?.args).toEqual(["--acp", "--no-auto-update"]);
    }).pipe(Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });
});
