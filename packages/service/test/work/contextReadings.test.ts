import { realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { type HarnessName, harnessNames, type ThreadId } from "@outlore/contracts";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { Harness, makeHarnessRouter, serviceLayer } from "../../src/index.ts";
import { type AcpFakeConfig, acpFakeEnv, acpFakeScript } from "../fixtures/acpFake.ts";
import { call, read, settle, startMission, temporary } from "../fixtures/service.ts";
import { answerOpen, idleWith } from "../fixtures/standIns.ts";

// A turn that reports only its context (no token counts) keeps its gauge reading while its token usage stays unknown.

/** A service whose Cursor harness runs the ACP stand-in with `config`. */
const withAcpContextService = (config: AcpFakeConfig) => {
  const directory = realpathSync(temporary("outlore-context-only-"));
  const log = join(directory, "log.jsonl");
  const harness = Layer.effect(
    Harness,
    makeHarnessRouter(
      Object.fromEntries(harnessNames.map((name) => [name, process.execPath])) as Record<HarnessName, string>,
      { idleTimeout: "10 minutes", sandboxProblem: null },
      {
        cursor: {
          env: acpFakeEnv(log, config),
          prefixArgs: [acpFakeScript],
        },
      },
    ),
  );
  return serviceLayer({
    accountsRoot: join(directory, "accounts"),
    filename: join(directory, "outlore.sqlite"),
    harness,
    homeFolder: directory,
    scratchRoot: join(directory, "missions"),
  });
};

const panelOf = (threadId: ThreadId) => call({ _tag: "ReadThreadPanel", threadId });

describe("a context-only ACP turn keeps its gauge while usage stays unknown", () => {
  it.live("shows the context gauge and window without writing a usage row or spending", () =>
    Effect.gen(function* () {
      const started = yield* startMission({ harness: "cursor", model: "model-a", text: "Hello" });
      yield* answerOpen("Allow");
      yield* settle(started.missionId, idleWith(2));

      const panel = yield* panelOf(started.threadId);
      expect(panel.context).not.toBeNull();
      expect(panel.context?.tokens).toBe(4321);
      expect(panel.context?.windowTokens).toBe(128_000);
      expect(panel.context?.isSoftLimit).toBe(false);
      expect(panel.spending).toEqual({ cost: 0, tokens: 0 });
      expect(panel.turnCount).toBe(0);

      const detail = yield* read(started.missionId, started.threadId);
      expect(detail.loreGauge.windowTokens).toBe(128_000);

      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT turn_id FROM usage`).toEqual([]);

      const usage = yield* call({ _tag: "ReadUsage", filters: [], period: { _tag: "Days", days: 7 } });
      expect(usage.gaps.turnsWithoutUsage).toBe(1);
      expect(usage.amounts.turns).toBe(0);
      expect(usage.amounts.tokens).toEqual({ cacheCreation: 0, cacheRead: 0, input: 0, output: 0 });
    }).pipe(Effect.provide(withAcpContextService({ contextSize: 128_000, contextUsed: 4321, usage: "context" }))),
  );

  it.live("keeps reading the context gauge and window from an older usage row", () =>
    Effect.gen(function* () {
      const started = yield* startMission({ harness: "cursor", model: "model-a", text: "Hello" });
      yield* answerOpen("Allow");
      yield* settle(started.missionId, idleWith(2));

      const sql = yield* SqlClient.SqlClient;
      // An older usage row from before separate context readings still feeds the gauge when it is the latest reading.
      yield* sql`INSERT INTO usage (turn_id, mission_id, thread_id, ended_at, input, output, cache_read, cache_creation,
          context, context_window, billing, harness, model)
        VALUES ('older-turn', ${started.missionId}, ${started.threadId}, 1, 10, 5, 0, 0, 9876, 150000, 'Unknown', 'cursor', 'model-a')`;

      const panel = yield* panelOf(started.threadId);
      expect(panel.context?.tokens).toBe(9876);
      expect(panel.context?.windowTokens).toBe(150_000);
      expect((yield* read(started.missionId, started.threadId)).loreGauge.windowTokens).toBe(150_000);

      // A newer context reading supersedes the older usage row for both used tokens and window size.
      yield* sql`INSERT INTO context_readings (thread_id, turn_id, model, used, size, recorded_at)
        VALUES (${started.threadId}, NULL, 'model-a', 12000, 180000, 100)`;
      const updated = yield* panelOf(started.threadId);
      expect(updated.context?.tokens).toBe(12_000);
      expect(updated.context?.windowTokens).toBe(180_000);
      expect((yield* read(started.missionId, started.threadId)).loreGauge.windowTokens).toBe(180_000);
    }).pipe(Effect.provide(withAcpContextService({ usage: "none" }))),
  );

  it.live("writes one context-limit warning when a context-only turn reaches the window", () =>
    Effect.gen(function* () {
      const started = yield* startMission({ harness: "cursor", model: "model-a", text: "Hello" });
      yield* answerOpen("Allow");
      const detail = yield* settle(started.missionId, idleWith(2));
      const warnings = detail.handovers.filter((line) => line.text.includes("context")).map((line) => line.text);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("128,000 tokens");
      const sql = yield* SqlClient.SqlClient;
      expect(yield* sql`SELECT turn_id FROM usage`).toEqual([]);
    }).pipe(Effect.provide(withAcpContextService({ contextSize: 128_000, contextUsed: 128_000, usage: "context" }))),
  );
});
