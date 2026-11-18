import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { HarnessFailure } from "../../src/core/index.ts";
import { makeCodexHarness } from "../../src/index.ts";
import { computerNameOf } from "../../src/remote/config.ts";
import { call, sendTo, settle, startMission } from "../fixtures/service.ts";
import {
  answerOpen,
  attachedPng,
  idleWith,
  pngBytes,
  replies,
  untilRequested,
  withHarnesses,
} from "../fixtures/standIns.ts";
import { turnRequestOf } from "../fixtures/turns.ts";

describe("running Codex threads", () => {
  it.live("gives Codex one localImage item per image, by the stored path", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const card = yield* attachedPng();
      const started = yield* startMission({ attachmentIds: [card.id], harness: "codex", model: "gpt-x", text: "See" });
      yield* settle(started.missionId, idleWith(1));
      const input = requests("turn/start")[0]?.params as { input: Array<Record<string, unknown>> };
      expect(input.input[0]).toMatchObject({ text: expect.stringContaining("See"), type: "text" });
      expect(input.input[1]).toMatchObject({ type: "localImage" });
      expect(readFileSync(String(input.input[1]?.path)).subarray(0, 4)).toEqual(pngBytes().subarray(0, 4));
    }).pipe(Effect.provide(layer));
  });

  it.live("runs a thread through the app server with its model, effort, tools, and no Outlore secrets", () => {
    const { layer, logged, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ effort: "high", harness: "codex", model: "gpt-x", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: Hello"]);
      expect(detail.thread).toMatchObject({ accountId: null, accountLabel: computerNameOf(), harness: "codex" });
      // The input counts Codex reports include the cached part, which is counted apart.
      expect(detail.mission.usage).toEqual({ cacheCreation: 1, cacheRead: 30, input: 69, output: 7 });
      // The context is the latest call's input, which includes the cached part, and its output.
      expect((yield* call({ _tag: "ReadThreadPanel", threadId: started.threadId })).context?.tokens).toBe(107);
      const [thread] = requests("thread/start");
      expect(thread?.params).toMatchObject({
        approvalPolicy: "on-request",
        // Codex's own workspace sandbox, with its network open; never its full-access mode.
        config: {
          "features.multi_agent": false,
          project_doc_max_bytes: 0,
          "sandbox_workspace_write.network_access": true,
        },
        model: "gpt-x",
        sandbox: "workspace-write",
      });
      expect(JSON.stringify(logged())).not.toContain("danger-full-access");
      expect(JSON.stringify(thread?.params?.config)).toMatch(
        /"mcp_servers\.outlore\.url":"http:\/\/127\.0\.0\.1:\d+\//,
      );
      // The longest tool-call wait Codex accepts, about 24.8 days in seconds: no wait in practice (action-approval).
      expect(thread?.params?.config).toMatchObject({ "mcp_servers.outlore.tool_timeout_sec": 2_147_483 });
      expect(String(thread?.params?.developerInstructions)).toContain("# Approvals in Outlore");
      expect(String(thread?.params?.developerInstructions)).not.toContain("dangerouslyDisableSandbox");
      expect(requests("turn/start")[0]?.params).toMatchObject({ effort: "high", model: "gpt-x" });
      expect(logged().find((entry) => entry.pid !== undefined)?.env).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("counts a ChatGPT sign-in's turn as subscription tokens", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.mission.budget.spent).toEqual({ cost: 0, tokens: 107 });
    }).pipe(Effect.provide(layer));
  });

  it.live("counts an API-key sign-in's turn as cost, which Codex reports none for, so no tokens count", () => {
    process.env.STAND_IN_CODEX_ACCOUNT = "apiKey";
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.mission.budget.spent).toEqual({ cost: 0, tokens: 0 });
    }).pipe(Effect.provide(layer));
  });

  it.live("reads an account's plan limits from the app server, once, and keeps the reading", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const own = () =>
        call({ _tag: "ReadAccountBudgets" }).pipe(
          Effect.map((budgets) => budgets.find((budget) => budget.harness === "codex" && budget.accountId === null)),
        );
      // The first answer carries none yet and starts the read; the reading arrives with the next.
      yield* own();
      let reading = yield* own();
      for (let attempt = 0; attempt < 100 && (reading?.planLimits ?? null) === null; attempt++) {
        yield* Effect.sleep("50 millis");
        reading = yield* own();
      }
      expect(reading?.planLimits?.windows).toEqual([
        { label: "5-hour", resetsAt: 1794405450000, usedPercent: 40, windowMinutes: 300 },
        { label: "Weekly", resetsAt: 1794412621000, usedPercent: 93, windowMinutes: 10080 },
      ]);
      yield* own();
      yield* own();
      expect(requests("account/rateLimits/read")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("gives an API-key account no plan limits, and asks for none", () => {
    process.env.STAND_IN_CODEX_ACCOUNT = "apiKey";
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      for (let attempt = 0; attempt < 5; attempt++) {
        yield* call({ _tag: "ReadAccountBudgets" });
        yield* Effect.sleep("100 millis");
      }
      expect(requests("account/rateLimits/read")).toHaveLength(0);
      const own = (yield* call({ _tag: "ReadAccountBudgets" })).find(
        (budget) => budget.harness === "codex" && budget.accountId === null,
      );
      expect(own?.planLimits).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("shows no plan limits when the app server cannot give them, and does not ask again at once", () => {
    process.env.STAND_IN_CODEX_LIMITS = "fail";
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      for (let attempt = 0; attempt < 6; attempt++) {
        yield* call({ _tag: "ReadAccountBudgets" });
        yield* Effect.sleep("100 millis");
      }
      expect(requests("account/rateLimits/read")).toHaveLength(1);
      const own = (yield* call({ _tag: "ReadAccountBudgets" })).find(
        (budget) => budget.harness === "codex" && budget.accountId === null,
      );
      expect(own?.planLimits).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner, naming the exact command, before any command Codex would run outside its sandbox", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "run ls" });
      const answered = yield* answerOpen("Allow");
      expect(answered).toMatchObject({ details: "ls", permission: "Run outside the sandbox" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["ls: accept"]);
    }).pipe(Effect.provide(layer));
  });

  it.live(
    "asks about a command as an ordinary one, not an escape, at the level asking before commands and edits",
    () => {
      const { layer } = withHarnesses();
      return Effect.gen(function* () {
        const settings = yield* call({ _tag: "ReadSettings" });
        yield* call({ _tag: "UpdateSettings", settings: { ...settings, approvalLevel: "CommandsAndEdits" } });
        const started = yield* startMission({ harness: "codex", text: "run ls" });
        const answered = yield* answerOpen("Allow");
        expect(answered).toMatchObject({ details: "ls", permission: "Run a command" });
        expect(answered.summary).not.toContain("outside the sandbox");
        expect(replies(yield* settle(started.missionId, idleWith(1)))).toEqual(["ls: accept"]);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("holds Codex on neutral choices and returns answers by its question id", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "choose" });
      const detail = yield* settle(started.missionId, (detail) =>
        detail.questions.some((question) => question.outcome === null),
      );
      const question = detail.questions.find((question) => question.outcome === null);
      if (question === undefined) return yield* Effect.die("No choice question");
      expect(question.choices?.[0]).toMatchObject({ allowsOther: true, multiple: false, question: "Which build?" });
      yield* call({ _tag: "AnswerChoices", answers: [["Use C"]], questionId: question.id });
      expect(replies(yield* settle(started.missionId, idleWith(1)))).toEqual([
        '{"answers":{"build":{"answers":["Use C"]}}}',
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("fails the turn, rather than leave Codex waiting, when the owner cannot be asked", () =>
    Effect.gen(function* () {
      const harness = yield* makeCodexHarness({
        command: process.execPath,
        idleTimeout: "10 minutes",
        prefixArgs: [join(import.meta.dirname, "..", "fixtures", "stand-in-codex.mjs")],
      });
      const failure = yield* harness
        .runTurn(
          turnRequestOf({
            askOwner: () => Effect.fail(new HarnessFailure({ reason: "Outlore could not ask about Bash." })),
            harness: "codex",
            text: "run git push origin main",
          }),
        )
        .pipe(Effect.flip);
      expect(failure.reason).toBe("Outlore could not ask about Bash.");
    }).pipe(Effect.scoped),
  );

  it.live("declines a command the owner denies", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "run git push origin main" });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["git push origin main: decline"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("resumes the same Codex thread once an idle process has closed", () => {
    const { layer, requests } = withHarnesses("50 millis");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      yield* sendTo(started.threadId, "two");
      yield* settle(started.missionId, idleWith(2));
      const first = requests("thread/start")[0];
      expect(first).toBeDefined();
      expect(requests("thread/resume")[0]?.params?.threadId).toMatch(/^codex-thread-\d+$/);
    }).pipe(Effect.provide(layer));
  });

  it.live("hands a Claude Code thread over to Codex with its conversation, in a new Codex thread", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ text: "Plan the work" });
      yield* settle(started.missionId, idleWith(1));
      yield* call({
        _tag: "ChangeThreadRunner",
        accountId: null,
        effort: "high",
        harness: "codex",
        model: "gpt-x",
        threadId: started.threadId,
      });
      yield* sendTo(started.threadId, "Carry on");
      const detail = yield* settle(started.missionId, idleWith(2));
      expect(detail.thread).toMatchObject({ harness: "codex", model: "gpt-x" });
      // A new Codex thread, not a resumed one, and the turn's input holds the earlier conversation.
      expect(requests("thread/start")).toHaveLength(1);
      expect(requests("thread/resume")).toHaveLength(0);
      const input = JSON.stringify(requests("turn/start")[0]?.params?.input);
      expect(input).toContain("Conversation so far");
      expect(input).toContain("Plan the work");
      // The first reply, as the JSON input escapes it.
      expect(input).toContain(JSON.stringify(replies(detail)[0]).slice(1, -1));
      expect(input).toContain("Carry on");
    }).pipe(Effect.provide(layer));
  });

  it.live("takes a steered message into the running turn", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "slow 600" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
      yield* untilRequested(requests, "turn/start");
      // The adapter learns the turn's id from Codex's answer to `turn/start`, a moment after the stand-in logs the
      // request; a message steered before that waits for the next turn, as designed, which this test is not about.
      yield* Effect.sleep("150 millis");
      yield* sendTo(started.threadId, "also this", "Steer");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: slow 600 + also this"]);
      expect(requests("turn/start")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("ends an interrupted turn without a reply", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "slow 5000" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
      yield* untilRequested(requests, "turn/start");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      expect(replies(detail)).toEqual([]);
      expect(requests("turn/interrupt")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("ends a turn interrupted before Codex has answered turn/start, once it has the turn", () => {
    process.env.STAND_IN_CODEX_START_DELAY = "300";
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "slow 5000" });
      yield* untilRequested(requests, "turn/start");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      expect(replies(detail)).toEqual([]);
      expect(requests("turn/interrupt")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("fails the turn when Codex reports that the thread-tools server failed to start", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "mcp-failed" });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
      expect(detail.thread.failure).toContain("thread tools");
      expect(detail.thread.failure).toContain("stand-in: no route");
    }).pipe(Effect.provide(layer));
  });

  it.live("fails the thread with Codex's reason when a turn fails", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "codex", text: "fail" });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
      expect(detail.thread.failure).toBe("stand-in: the turn failed");
    }).pipe(Effect.provide(layer));
  });
});
