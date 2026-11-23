import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { claudeHarnessLayer, serviceLayer } from "../../src/index.ts";
import { standIn, withClaude } from "../fixtures/claude.ts";
import { call, temporary } from "../fixtures/service.ts";

describe("reading and saving settings", () => {
  it.live("starts from defaults and persists updates", () => {
    const directory = temporary("outlore-claude-");
    const options = {
      filename: join(directory, "outlore.sqlite"),
      harness: claudeHarnessLayer({
        command: process.execPath,
        idleTimeout: "1 minute",
        prefixArgs: [standIn],
        sandboxProblem: null,
      }),
      homeFolder: directory,
      scratchRoot: join(directory, "missions"),
    };
    return Effect.gen(function* () {
      const defaults = yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(serviceLayer(options)));
      expect(defaults).toEqual({
        autoArchiveDays: 30,
        backgroundCheckIns: null,
        backups: [],
        briefingLimit: 2000,
        chatterThreshold: 20,
        companionPresets: { custom: [], tierNames: {} },
        defaultEffort: "default",
        defaultHarness: "claude",
        defaultMissionBudget: { cost: null, tokens: null },
        defaultModel: "claude-sonnet-5-5",
        defaultPermissionMode: "Auto",
        globalBudget: { cost: null, tokens: null },
        globalBudgetPeriod: "Month",
        inactivityDays: 14,
        intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
        intelWarningPercent: 10,
        shouldAllowRemoteTerminals: false,
        shouldAutoArchive: false,
        shouldFetchPrices: true,
        shouldOpenOffTopicMissions: false,
        shouldShowAgentThreads: true,
        shouldShowFinishedQuests: false,
        shouldStreamReplies: true,
        shouldUseCodeMode: false,
        tiers: { Balanced: null, Heavy: null, Light: null },
      });

      const updated = {
        autoArchiveDays: 10,
        backgroundCheckIns: null,
        backups: [],
        briefingLimit: 500,
        chatterThreshold: 20,
        companionPresets: { custom: [], tierNames: {} },
        defaultEffort: "high",
        defaultHarness: "codex",
        defaultMissionBudget: { cost: null, tokens: null },
        defaultModel: "sonnet",
        defaultPermissionMode: "Supervised",
        globalBudget: { cost: null, tokens: null },
        globalBudgetPeriod: "Month",
        inactivityDays: 7,
        intelHalfLives: { decision: 30, fact: 60, preference: 120, temporary: 5 },
        intelWarningPercent: 25,
        shouldAllowRemoteTerminals: false,
        shouldAutoArchive: true,
        shouldFetchPrices: true,
        shouldOpenOffTopicMissions: true,
        shouldShowAgentThreads: true,
        shouldShowFinishedQuests: false,
        shouldStreamReplies: false,
        shouldUseCodeMode: true,
        tiers: { Balanced: null, Heavy: null, Light: null },
      } as const;
      yield* call({ _tag: "UpdateSettings", settings: updated }).pipe(Effect.provide(serviceLayer(options)));
      expect(yield* call({ _tag: "ReadSettings" }).pipe(Effect.provide(serviceLayer(options)))).toEqual(updated);
    });
  });

  it.live("keep the owner's saved choices when a setting added later is missing", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      const saved = { defaultEffort: "high", defaultModel: "sonnet", defaultPermissionMode: "Supervised" };
      yield* sql`INSERT INTO settings (key, value) VALUES ('settings', ${JSON.stringify({ ...saved, shouldStreamReplies: false })})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
      expect(yield* call({ _tag: "ReadSettings" })).toEqual({
        ...saved,
        autoArchiveDays: 30,
        backgroundCheckIns: null,
        backups: [],
        briefingLimit: 2000,
        chatterThreshold: 20,
        companionPresets: { custom: [], tierNames: {} },
        defaultHarness: "claude",
        defaultMissionBudget: { cost: null, tokens: null },
        globalBudget: { cost: null, tokens: null },
        globalBudgetPeriod: "Month",
        inactivityDays: 14,
        intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
        intelWarningPercent: 10,
        shouldAllowRemoteTerminals: false,
        shouldAutoArchive: false,
        shouldFetchPrices: true,
        shouldOpenOffTopicMissions: false,
        shouldShowAgentThreads: true,
        shouldShowFinishedQuests: false,
        shouldStreamReplies: false,
        shouldUseCodeMode: false,
        tiers: { Balanced: null, Heavy: null, Light: null },
      });
    }).pipe(Effect.provide(layer));
  });
});
