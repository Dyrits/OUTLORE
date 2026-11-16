import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { markPrompted } from "../../src/work/activities.ts";
import { unaskedToolNamesOf } from "../../src/work/threadTools.ts";
import { withClaude, withoutNote } from "../fixtures/claude.ts";
import { call, read, sendTo, settle, startMission } from "../fixtures/service.ts";
import { idleWith } from "../fixtures/standIns.ts";

// Stored and wire names keep `intel` so existing data and agents still work: settings keys (`intelHalfLives`, `intelWarningPercent`).

describe("running Claude Code threads", () => {
  it.live("runs the thread's model and effort sandboxed, prompts sent to Outlore, and no Outlore secrets", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* startMission({ effort: "high", model: "opus", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));

      expect(detail.messages.map((message) => message.sender)).toEqual(["user", "agent"]);
      expect(detail.messages.map((message) => message.model)).toEqual([null, "claude-sonnet-5-5"]);
      expect(withoutNote(detail.messages[1]?.text)).toMatch(/^Reply 1 .* to: Hello$/);
      expect(detail.thread).toMatchObject({ effort: "high", failure: null, model: "opus" });

      const [start] = starts();
      const args = start?.args.join(" ") ?? "";
      expect(args).toContain("--input-format stream-json --output-format stream-json");
      expect(args).toContain("--model opus");
      expect(args).toContain("--effort high");
      expect(args).toContain("--permission-prompts host --permission-prompt-tool mcp__outlore__answer_prompt");
      expect(args).toContain("--allowedTools mcp__outlore__request_approval");
      expect(args).toContain(
        `--allowedTools mcp__outlore__request_approval ${unaskedToolNamesOf("outlore").join(" ")}`,
      );
      expect(args).toContain("--strict-mcp-config");
      expect(args).toContain("--permission-mode acceptEdits");
      expect(start?.args[start.args.indexOf("--tools") + 1]).toBe("default");
      const settings = JSON.parse(start?.args[start.args.indexOf("--settings") + 1] ?? "{}");
      // Never unsandboxed on a warning: a sandbox that cannot start stops Claude Code instead.
      expect(settings.sandbox).toMatchObject({
        autoAllowBashIfSandboxed: true,
        enabled: true,
        failIfUnavailable: true,
      });
      const mcp = JSON.parse(start?.args[start.args.indexOf("--mcp-config") + 1] ?? "{}");
      expect(mcp.mcpServers.outlore.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/mcp\/[0-9a-f]{48}$/);
      // Claude Code aborts a silent call after 300 seconds unless the server sets its own timeout.
      expect(mcp.mcpServers.outlore.timeout).toBe(2147483647);
      expect(args).toMatch(/--session-id [0-9a-f-]{36}/);
      expect(start?.env).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("lists a turn's tool calls as steps, and hides a call that reached the permission prompt", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      const started = yield* startMission({ text: "use-tools" });
      const detail = yield* settle(started.missionId, idleWith(1));
      // The approval tool has its own question line, so it is no step.
      expect(detail.activities.map(({ detail: target, summary }) => [summary, target])).toEqual([
        ["Read a file", "/work/entries.ts"],
        ["List the folder", "ls -la…"],
        ["Use an Outlore tool", "update journal"],
      ]);
      // A call that was also asked about shows once, as its action; a prompt that came first leaves a hidden mark.
      const threadId = detail.thread.id;
      yield* markPrompted(threadId, "toolu_read_1", 1);
      yield* markPrompted(threadId, "toolu_not_reported_yet", 2);
      const after = yield* read(started.missionId);
      expect(after.activities.map((activity) => activity.summary)).toEqual(["List the folder", "Use an Outlore tool"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("starts Claude Code in the workspace with its instructions in the system prompt", () => {
    const { directory, layer, starts } = withClaude();
    const app = join(realpathSync(directory), "app");
    mkdirSync(app);
    writeFileSync(join(app, "AGENTS.md"), "Use Bun, never pnpm.");
    return Effect.gen(function* () {
      const started = yield* startMission({ text: "Hi", workspacePath: app });
      yield* settle(started.missionId, idleWith(1));
      const [start] = starts();
      expect(start?.cwd).toBe(app);
      const prompt = start?.args[start.args.indexOf("--append-system-prompt") + 1] ?? "";
      expect(prompt).toContain(`You work in the workspace "app" at ${app}.`);
      expect(prompt).toContain("## AGENTS.md\nUse Bun, never pnpm.");
      expect(prompt).toContain("# Approvals in Outlore");
    }).pipe(Effect.provide(layer));
  });

  it.live("lets a sandboxed thread reach a broad allowlist of hosts unasked, which Claude Code accepts", () => {
    const { directory, layer, starts } = withClaude();
    const app = join(realpathSync(directory), "app");
    mkdirSync(app);
    return Effect.gen(function* () {
      for (const workspacePath of [app, null]) {
        const started = yield* startMission({ text: "Hi", workspacePath });
        yield* settle(started.missionId, idleWith(1));
      }
      for (const start of starts()) {
        const settings = JSON.parse(start.args[start.args.indexOf("--settings") + 1] ?? "{}");
        const { allowedDomains, allowLocalBinding } = settings.sandbox.network;
        expect(allowLocalBinding).toBe(true);
        expect(allowedDomains).toEqual(
          expect.arrayContaining([
            "registry.npmjs.org",
            "github.com",
            "*.github.com",
            "*.githubusercontent.com",
            "pypi.org",
            "files.pythonhosted.org",
            "crates.io",
            "proxy.golang.org",
            "cdn.jsdelivr.net",
            "unpkg.com",
          ]),
        );
        // Claude Code 2.1.322 refuses "*" and a bare top-level wildcard such as "*.com": a broad allowlist, not open egress.
        for (const domain of allowedDomains) {
          expect(
            domain === "*" || /^\*\.[^.]+$/.test(domain) || domain.slice(domain.startsWith("*.") ? 2 : 0).includes("*"),
            domain,
          ).toBe(false);
        }
        expect(settings.sandbox.filesystem.allowWrite).toEqual([
          "~/.bun/install/cache",
          "~/.npm",
          "~/Library/Caches/electron",
          "~/.cache/electron",
        ]);
        expect(settings.env).toEqual({ NODE_USE_ENV_PROXY: "1" });
      }
    }).pipe(Effect.provide(layer));
  });
});

describe("telling a Claude Code thread its budget", () => {
  it.live("keeps one process as the budget line changes, and gives the line with the turn", () => {
    const { layer, starts } = withClaude();
    return Effect.gen(function* () {
      const started = yield* startMission({ text: "One" });
      yield* settle(started.missionId, idleWith(1));
      yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 100000 }, missionId: started.missionId });
      yield* sendTo(started.threadId, "Two");
      yield* settle(started.missionId, idleWith(2));
      yield* sendTo(started.threadId, "Three");
      const detail = yield* settle(started.missionId, idleWith(3));
      expect(starts()).toHaveLength(1);
      expect(detail.messages.at(-1)?.text).toContain("Budget: ");
    }).pipe(Effect.provide(layer));
  });
});

describe("a thread-tools server that fails to load", () => {
  it.live("fails the turn with a reason and runs it on Retry once the server loads (tool-and-skill-loading)", () => {
    const { layer } = withClaude();
    return Effect.gen(function* () {
      process.env.STAND_IN_MCP_STATUS = "failed";
      const started = yield* startMission({ text: "Hello" });
      const failed = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
      expect(failed.thread.failure).toContain("thread tools");
      expect(failed.messages.map((message) => message.sender)).toEqual(["user"]);
      process.env.STAND_IN_MCP_STATUS = "connected";
      yield* call({ _tag: "RetryThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.thread.failure).toBeNull();
    }).pipe(Effect.provide(layer));
  });
});

describe("holding a failed thread at a reached budget", () => {
  it.live(
    "holds the message to a Failed thread in Attention and runs it once the budget is raised",
    () => {
      const { layer } = withClaude({ idleTimeout: "50 millis" });
      return Effect.gen(function* () {
        const started = yield* startMission({ text: "One" });
        yield* settle(started.missionId, idleWith(1));
        // The idle process closes, so the next turn starts one that fails.
        yield* Effect.sleep("200 millis");
        process.env.STAND_IN_MODE = "fail-start";
        yield* sendTo(started.threadId, "Two");
        yield* settle(started.missionId, (current) => current.thread.state === "Failed");
        yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 100 }, missionId: started.missionId });
        process.env.STAND_IN_MODE = "ok";
        yield* sendTo(started.threadId, "Three");
        yield* settle(
          started.missionId,
          (current) => current.thread.state === "Attention" && current.thread.blocker === "Budget",
        );
        yield* call({ _tag: "SetMissionBudget", limits: { cost: null, tokens: 100000 }, missionId: started.missionId });
        const detail = yield* settle(started.missionId, idleWith(2));
        expect(detail.messages.at(-1)?.text).toContain("Three");
      }).pipe(Effect.provide(layer));
    },
    20_000,
  );
});
