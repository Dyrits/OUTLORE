import { mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect, PubSub } from "effect";
import { Changes, makeClaudeHarness } from "../../src/index.ts";
import { standIn, withClaude, withoutNote } from "../fixtures/claude.ts";
import { createRepository, runGit } from "../fixtures/repositories.ts";
import { call, sendTo, settle, startMission, temporary } from "../fixtures/service.ts";
import { idleWith } from "../fixtures/standIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

describe("using a workspace's git worktrees", () => {
  const caches = ["~/.bun/install/cache", "~/.npm", "~/Library/Caches/electron", "~/.cache/electron"];
  const writableOf = (args: string[] | undefined) =>
    JSON.parse(args?.[args.indexOf("--settings") + 1] ?? "{}").sandbox?.filesystem?.allowWrite;

  it.live("lets a sandboxed thread write the worktrees of its workspace, and no other folder", () => {
    const { directory, layer, starts } = withClaude();
    const app = createRepository(realpathSync(directory), "app");
    const worktree = join(realpathSync(directory), "app-side");
    runGit(app, "worktree", "add", "-q", "-b", "side", worktree);
    mkdirSync(join(realpathSync(directory), "app-unrelated"));
    return Effect.gen(function* () {
      const started = yield* startMission({ text: "Hi", workspacePath: app });
      yield* settle(started.missionId, idleWith(1));
      expect(writableOf(starts()[0]?.args)).toEqual([...caches, worktree]);
    }).pipe(Effect.provide(layer));
  });

  it.live("restarts the process, resuming its session, when a worktree is added", () => {
    const { directory, layer, starts } = withClaude();
    const app = createRepository(realpathSync(directory), "app");
    return Effect.gen(function* () {
      const started = yield* startMission({ text: "One", workspacePath: app });
      yield* settle(started.missionId, idleWith(1));
      const worktree = join(realpathSync(directory), "app-late");
      runGit(app, "worktree", "add", "-q", "-b", "late", worktree);
      yield* sendTo(started.threadId, "Two");
      yield* settle(started.missionId, idleWith(2));
      const [first, second] = starts();
      expect(second?.pid).not.toBe(first?.pid);
      expect(writableOf(first?.args)).toEqual(caches);
      expect(writableOf(second?.args)).toEqual([...caches, worktree]);
      expect(second?.args.join(" ")).toMatch(/--resume [0-9a-f-]{36}/);
    }).pipe(Effect.provide(layer));
  });
});

it.live("omits model and effort when the thread uses Claude Code's defaults", () => {
  const { layer, starts } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ text: "Hi" });
    yield* settle(started.missionId, idleWith(1));
    const args = starts()[0]?.args ?? [];
    expect(args).not.toContain("--model");
    expect(args).not.toContain("--effort");
  }).pipe(Effect.provide(layer));
});

it.live("keeps its system prompt and process across a journal change, and sends the change with the turn", () => {
  const { layer, starts } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ text: "One" });
    yield* settle(started.missionId, idleWith(1));
    yield* call({ _tag: "AddJournalEntry", missionId: started.missionId, requestId: "r2", text: "Chose SQLite." });
    yield* sendTo(started.threadId, "Two");
    const detail = yield* settle(started.missionId, idleWith(2));

    expect(starts()).toHaveLength(1);
    const systemPrompt = starts()[0]?.args[(starts()[0]?.args.indexOf("--append-system-prompt") ?? -2) + 1] ?? "";
    expect(systemPrompt).toContain("# Quest journal");
    expect(systemPrompt).not.toContain("Briefing (version");
    expect(detail.messages.at(-1)?.text).toMatch(
      /# Quest journal at this turn[\s\S]*Chose SQLite\.[\s\S]*\n---\n\nTwo$/,
    );
  }).pipe(Effect.provide(layer));
});

it.live("keeps its system prompt and process across a mission rename, and gives the title with the turn", () => {
  const { layer, starts } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ text: "One" });
    yield* settle(started.missionId, idleWith(1));
    yield* call({ _tag: "RenameMission", missionId: started.missionId, title: "Renamed mission" });
    yield* sendTo(started.threadId, "Two");
    const detail = yield* settle(started.missionId, idleWith(2));

    expect(starts()).toHaveLength(1);
    const systemPrompt = starts()[0]?.args[(starts()[0]?.args.indexOf("--append-system-prompt") ?? -2) + 1] ?? "";
    expect(systemPrompt).toContain(`You are thread ${started.threadId}`);
    expect(detail.messages.at(-1)?.text).toContain('Your title: "Renamed mission".');
  }).pipe(Effect.provide(layer));
});

it.live("keeps one process per thread across turns and adds up token usage", () => {
  const { layer, starts } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    yield* settle(started.missionId, idleWith(1));
    yield* sendTo(started.threadId, "Two");
    const detail = yield* settle(started.missionId, idleWith(2));

    expect(starts()).toHaveLength(1);
    expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 2 .* to: Two$/);
    expect(detail.mission.usage).toEqual({ cacheCreation: 100, cacheRead: 200, input: 4, output: 20 });
    const {
      missions: [summary],
    } = yield* call({ _tag: "ListMissions", isArchived: false, search: null, state: null, workspaceId: null });
    expect(summary?.usage.output).toBe(20);
  }).pipe(Effect.provide(layer));
});

it.live("takes the thread's context from the latest call, not the turn's summed usage", () => {
  const { layer } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    yield* settle(started.missionId, idleWith(1));
    const panel = yield* call({ _tag: "ReadThreadPanel", threadId: started.threadId });

    expect(panel.context?.tokens).toBe(75);
    expect(panel.turnCount).toBe(1);
  }).pipe(Effect.provide(layer));
});

it.live("shows the reply's own call under it, and the rest of the turn's usage with it, so the lines add up", () => {
  const { layer } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    const detail = yield* settle(started.missionId, idleWith(1));
    const usage = detail.messages.filter((message) => message.sender === "agent").at(-1)?.usage;
    // The call used 3 input, 7 output, 60 cache read, and 5 cache write tokens; the turn, 2, 10, 100, and 50 in all.
    // What the turn used beyond the call (3 output, 40 cache read, 45 cache write) joins it.
    expect(usage?.tokens).toEqual({ cacheCreation: 50, cacheRead: 100, input: 3, output: 10 });
  }).pipe(Effect.provide(layer));
});

it.live("records no model for a reply under Claude Code's own `<synthetic>` placeholder", () => {
  process.env.STAND_IN_MODEL = "<synthetic>";
  const { layer } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", text: "Hello" });
    const detail = yield* settle(started.missionId, idleWith(1));
    expect(detail.messages.map((message) => message.model)).toEqual([null, null]);
  }).pipe(Effect.provide(layer));
});

it.live("records each turn's own cost from the running total Claude Code reports, on an API key", () => {
  process.env.STAND_IN_COST = "1";
  process.env.STAND_IN_API_KEY_SOURCE = "ANTHROPIC_API_KEY";
  const { layer } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    yield* settle(started.missionId, idleWith(1));
    yield* sendTo(started.threadId, "Two");
    const detail = yield* settle(started.missionId, idleWith(2));

    expect(detail.mission.budget.spent.cost).toBeCloseTo(0.02, 6);
  }).pipe(Effect.provide(layer));
});

it.live("counts a subscription turn's tokens, not the cost Claude Code reports, when no API key signed it in", () => {
  process.env.STAND_IN_COST = "1";
  process.env.STAND_IN_API_KEY_SOURCE = "none";
  const { layer } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    const detail = yield* settle(started.missionId, idleWith(1));
    expect(detail.mission.budget.spent.cost).toBe(0);
    expect(detail.mission.budget.spent.tokens).toBeGreaterThan(0);
  }).pipe(Effect.provide(layer));
});

it.live("counts a turn as subscription tokens when Claude Code does not report how it signed in", () => {
  process.env.STAND_IN_COST = "1";
  const { layer } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    const detail = yield* settle(started.missionId, idleWith(1));
    expect(detail.mission.budget.spent.cost).toBe(0);
    expect(detail.mission.budget.spent.tokens).toBeGreaterThan(0);
  }).pipe(Effect.provide(layer));
});

it.live("restarts the process, resuming its session, when the approval level changes", () => {
  const { layer, starts } = withClaude();
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    yield* settle(started.missionId, idleWith(1));
    const settings = yield* call({ _tag: "ReadSettings" });
    yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
    yield* sendTo(started.threadId, "Two");
    yield* settle(started.missionId, idleWith(2));

    const [first, second] = starts();
    expect(second?.pid).not.toBe(first?.pid);
    const args = second?.args.join(" ") ?? "";
    expect(args).toMatch(/--resume [0-9a-f-]{36}/);
    expect(args).toContain("--permission-mode default");
    expect(JSON.parse(second?.args[(second?.args.indexOf("--settings") ?? 0) + 1] ?? "{}")).toEqual({
      permissions: {},
    });
  }).pipe(Effect.provide(layer));
});

it.live("restarts the process, resuming its session, when the thread's model changes", () => {
  const directory = temporary("outlore-claude-");
  const log = join(directory, "starts.jsonl");
  process.env.STAND_IN_LOG = log;
  const starts = (): Array<{ pid: number; args: string[] }> =>
    readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  return Effect.gen(function* () {
    const harness = yield* makeClaudeHarness({
      command: process.execPath,
      idleTimeout: "10 minutes",
      prefixArgs: [standIn],
      sandboxProblem: null,
      userSettingsPath: join(directory, "no-settings.json"),
    });
    const first = yield* harness.runTurn(turnRequestOf({ cwd: directory, model: "haiku", text: "One" }));
    yield* harness.runTurn(turnRequestOf({ cwd: directory, model: "opus", sessionId: first.sessionId, text: "Two" }));
    const [before, after] = starts();
    expect(after?.pid).not.toBe(before?.pid);
    expect(after?.args.join(" ")).toContain("--model opus");
    expect(after?.args[(after?.args.indexOf("--resume") ?? -2) + 1]).toBe(first.sessionId);
  }).pipe(Effect.scoped);
});

it.live("asks for every prompt at the default level when the sandbox is unavailable", () => {
  const { layer, starts } = withClaude({ sandboxProblem: "Sandbox unavailable: install bubblewrap." });
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    yield* settle(started.missionId, idleWith(1));
    const args = starts()[0]?.args.join(" ") ?? "";
    expect(args).toContain("--permission-mode default");
    const start = starts()[0];
    const settings = JSON.parse(start?.args[start.args.indexOf("--settings") + 1] ?? "{}");
    expect(settings.sandbox).toBeUndefined();
    const view = yield* call({ _tag: "ReadPermissions", missionId: null });
    expect(view.level).toBe("RiskyOnly");
  }).pipe(Effect.provide(layer));
});

it.live("reports itself sandboxed only at the default level on a host that can sandbox", () =>
  Effect.gen(function* () {
    const options = { command: process.execPath, idleTimeout: "10 minutes", prefixArgs: [standIn] } as const;
    const capable = yield* makeClaudeHarness({ ...options, sandboxProblem: null });
    const incapable = yield* makeClaudeHarness({ ...options, sandboxProblem: "Sandbox unavailable." });
    expect(capable.containmentOf?.("claude", "RiskyOnly")).toBe("Sandboxed");
    expect(capable.containmentOf?.("claude", "CommandsAndEdits")).toBe("Unprotected");
    expect(incapable.containmentOf?.("claude", "RiskyOnly")).toBe("Unprotected");
  }).pipe(Effect.scoped),
);

it.live("closes an idle process and resumes the same session for the next message", () => {
  const { layer, starts } = withClaude({ idleTimeout: "100 millis" });
  return Effect.gen(function* () {
    const started = yield* startMission({ effort: "low", model: "haiku", text: "One" });
    yield* settle(started.missionId, idleWith(1));
    yield* Effect.sleep("400 millis");
    yield* sendTo(started.threadId, "Two");
    const detail = yield* settle(started.missionId, idleWith(2));

    const [first, second] = starts();
    const sessionId = first?.args[first.args.indexOf("--session-id") + 1];
    expect(second?.args[second.args.indexOf("--resume") + 1]).toBe(sessionId);
    expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/^Reply 1 .* to: Two$/);
  }).pipe(Effect.provide(layer));
});

it.live("shows Failed with the reason, and the next message retries the failed turn's messages", () => {
  const { layer } = withClaude();
  return Effect.gen(function* () {
    process.env.STAND_IN_MODE = "fail-start";
    const started = yield* startMission({ effort: "low", model: "haiku", text: "First" });
    const failed = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
    expect(failed.thread.failure).toContain("stand-in: cannot start");
    expect(failed.mission.state).toBe("Failed");

    process.env.STAND_IN_MODE = "ok";
    yield* sendTo(started.threadId, "Second");
    const detail = yield* settle(started.missionId, idleWith(1));
    expect(withoutNote(detail.messages.at(-1)?.text)).toMatch(/to: First\n\nSecond$/);
    expect(detail.thread.failure).toBeNull();
  }).pipe(Effect.provide(layer));
});

it.live("treats an error reported by Claude Code as a failure, not as a reply", () => {
  const { layer } = withClaude();
  return Effect.gen(function* () {
    process.env.STAND_IN_MODE = "error-result";
    const started = yield* startMission({ effort: "low", model: "haiku", text: "Hi" });
    const failed = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
    expect(failed.thread.failure).toBe("There's an issue with the selected model.");
    expect(failed.messages.map((message) => message.sender)).toEqual(["user"]);
  }).pipe(Effect.provide(layer));
});

it.live("shows the reply as it is written only while the setting is on", () => {
  const { layer } = withClaude();
  return Effect.gen(function* () {
    const changes = yield* Changes;
    const drafts = yield* PubSub.subscribe(changes.drafts);

    const on = yield* startMission({ effort: "low", model: "haiku", text: "Hi" });
    yield* settle(on.missionId, idleWith(1));
    const seen = (yield* PubSub.takeAll(drafts)).map((current) => current.text);
    expect(seen.some((text) => text.startsWith("Reply 1 "))).toBe(true);
    expect(seen.at(-1)).toBe("");

    yield* call({
      _tag: "UpdateSettings",
      settings: {
        approvalLevel: "RiskyOnly",
        autoArchiveDays: 30,
        backups: [],
        briefingLimit: 2000,
        chatterThreshold: 20,
        defaultDelivery: "Steer",
        defaultEffort: "default",
        defaultHarness: "claude",
        defaultMissionBudget: { cost: null, tokens: null },
        defaultModel: "default",
        globalBudget: { cost: null, tokens: null },
        globalBudgetPeriod: "Month",
        inactivityDays: 14,
        intelHalfLives: { decision: 45, fact: 45, preference: 90, temporary: 3 },
        intelWarningPercent: 10,
        shouldAllowOutsideSandbox: false,
        shouldAutoArchive: false,
        shouldFetchPrices: true,
        shouldOpenOffTopicMissions: false,
        shouldShowAgentThreads: true,
        shouldShowFinishedQuests: false,
        shouldStreamReplies: false,
        shouldUseCodeMode: false,
        tiers: { Balanced: null, Heavy: null, Light: null },
      },
    });
    const off = yield* startMission({ effort: "low", model: "haiku", text: "Hi" });
    yield* settle(off.missionId, idleWith(1));
    expect((yield* PubSub.takeAll(drafts)).filter((current) => current.text !== "")).toEqual([]);
  }).pipe(Effect.provide(layer));
});
