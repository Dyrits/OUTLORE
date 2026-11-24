import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import type { HarnessEvent } from "../../src/core/index.ts";
import { devin } from "../../src/harness/devinProvider.ts";
import { type AcpFakeConfig, acpFakeEnv, acpFakeRequest, acpFakeScript } from "../fixtures/acpFake.ts";
import { standInHarness, standInProbe } from "../fixtures/providerStandIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

// Fixture checks of the Devin harness against the one configurable ACP stand-in, acpFake.mjs: the launch carries the pinned argv
// ("acp", no extra environment) and a turn mediates its tool calls through the owner exactly as the generic ACP adapter
// does. Only a signed-in session lists models, so a probe of an unsigned CLI answering with none is covered by the
// generic adapter reading whatever the session gives.

const configOf = (mode: "probe" | "turn"): AcpFakeConfig => ({
  mode,
  models: [["Devin 3.0", "devin-3.0"]],
  usage: "update",
});

const probeOf = (log: string) =>
  standInProbe(devin, {
    command: "node",
    env: acpFakeEnv(log, configOf("probe")),
    prefixArgs: [acpFakeScript],
  }).pipe(Effect.runPromise);

describe("probing the devin CLI", () => {
  it("reads the session's models with the pinned argv", async () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-devin-probe-"));
    const log = join(directory, "calls");
    try {
      const models = await probeOf(log);
      expect(models).toEqual([{ id: "devin-3.0", label: "Devin 3.0" }]);
      await vi.waitFor(() => expect(readFileSync(log, "utf8")).toContain('"exit":true'));
      const entry = acpFakeRequest(log, "session/new");
      expect(entry.launch?.argv).toEqual(["acp"]);
      expect(entry.params?.mcpServers).toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("pins no environment of its own", () => {
    expect(devin.spawnEnv).toEqual({});
  });
});

describe("running a thread on the devin CLI", () => {
  const harnessOf = (log: string) =>
    standInHarness("devin", {
      command: "node",
      env: acpFakeEnv(log, configOf("turn")),
      idleTimeout: "10 minutes",
      prefixArgs: [acpFakeScript],
    });

  it.live("mediates a tool permission request the owner allows", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-devin-turn-"));
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
      expect(acpFakeRequest(log, "session/prompt").launch?.argv).toEqual(["acp"]);
    }).pipe(Effect.scoped, Effect.ensuring(Effect.sync(() => rmSync(directory, { force: true, recursive: true }))));
  });

  it.live("answers a denial with the provider's reject option and carries the turn on", () => {
    const directory = mkdtempSync(join(tmpdir(), "outlore-devin-turn-"));
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
