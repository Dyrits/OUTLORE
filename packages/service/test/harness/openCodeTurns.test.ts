import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { HarnessTools, listOpenCodeEfforts, liveHarnessToolsLayer } from "../../src/index.ts";
import { call, sendTo, settle, startMission, temporary } from "../fixtures/service.ts";
import { attachedPng, idleWith, pngBytes, replies, untilRequested, withHarnesses } from "../fixtures/standIns.ts";

const standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs")];
const _spawnChild = join(import.meta.dirname, "..", "fixtures", "stand-in-spawn-child.mjs");
describe("running OpenCode threads", () => {
  it.live("gives OpenCode one base64 ACP image block per image", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const card = yield* attachedPng();
      const started = yield* startMission({
        attachmentIds: [card.id],
        harness: "opencode",
        model: "provider/model-a",
        text: "See",
      });
      yield* settle(started.missionId, idleWith(1));
      const params = requests("session/prompt")[0]?.params as { prompt: Array<Record<string, unknown>> } | undefined;
      const prompt = params?.prompt ?? [];
      expect(prompt[0]).toMatchObject({ type: "text" });
      expect(prompt[1]).toEqual({
        data: pngBytes().toString("base64"),
        mimeType: "image/png",
        type: "image",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("runs a thread over ACP with Outlore's tools, permissions, context, and model", () => {
    const { layer, logged, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", model: "provider/model-a", text: "Hello" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["Echo: Hello "]);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
      expect((yield* call({ _tag: "ReadThreadPanel", threadId: started.threadId })).context?.tokens).toBe(138);
      const process = logged().find((entry) => entry.pid !== undefined);
      expect(process?.env).toEqual([]);
      const config = process?.config as {
        instructions: Array<string>;
        mcp: { servers: Record<string, { url: string }> };
        permissions: Array<{ action: string; effect: string }>;
      };
      expect(config.permissions).toEqual([
        { action: "shell", effect: "ask", resource: "*" },
        { action: "edit", effect: "ask", resource: "*" },
        { action: "subagent", effect: "deny", resource: "*" },
      ]);
      expect(config.mcp.servers.outlore?.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
      expect(readFileSync(config.instructions[0] ?? "", "utf8")).toContain("# Threads in Outlore");
      expect(requests("session/set_config_option")[0]?.params).toMatchObject({
        configId: "model",
        value: "provider/model-a",
      });
    }).pipe(Effect.provide(layer));
  });

  it.live("sets the chosen effort on OpenCode's session after its model", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({
        effort: "high",
        harness: "opencode",
        model: "provider/model-a",
        text: "Hello",
      });
      yield* settle(started.missionId, idleWith(1));
      expect(requests("session/set_config_option").map((request) => request.params)).toMatchObject([
        { configId: "model", value: "provider/model-a" },
        { configId: "effort", value: "high" },
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("reads a model's effort levels from OpenCode, none for a model without them", () =>
    Effect.gen(function* () {
      expect(yield* listOpenCodeEfforts(process.execPath, null, "provider/model-a", standIn)).toEqual(["none", "high"]);
      expect(yield* listOpenCodeEfforts(process.execPath, null, "provider/plain", standIn)).toEqual([]);
    }),
  );

  it.live("an OpenCode that cannot be asked for effort levels fails, which is not a model without levels", () =>
    Effect.gen(function* () {
      const failure = yield* listOpenCodeEfforts(join(tmpdir(), "no-such-opencode"), null, "provider/model-a").pipe(
        Effect.flip,
      );
      expect(JSON.stringify(failure)).toContain("effort levels");
    }),
  );

  it.live("reads OpenCode's effort levels ahead when it lists its models, so a pick starts no session", () => {
    const directory = realpathSync(temporary("outlore-warm-"));
    const log = join(directory, "log.jsonl");
    process.env.STAND_IN_LOG = log;
    // A command that lists two models and runs the stand-in as `opencode acp`.
    const command = join(directory, "opencode");
    writeFileSync(
      command,
      `#!/bin/sh\nif [ "$1" = models ]; then printf 'provider/model-a\\nprovider/plain\\n'; exit 0; fi\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs"))} "$@"\n`,
    );
    chmodSync(command, 0o755);
    const sessions = () =>
      (existsSync(log) ? readFileSync(log, "utf8") : "").split("\n").filter((line) => line.includes('"pid"')).length;
    return Effect.gen(function* () {
      const tools = yield* HarnessTools;
      const listed = yield* tools.listModels("opencode", null);
      expect(listed.map((option) => option.id)).toEqual(["provider/model-a", "provider/plain"]);
      // The levels are read in the background; wait for both models' sessions.
      for (let attempt = 0; attempt < 100 && sessions() < 2; attempt++) yield* Effect.sleep("100 millis");
      yield* Effect.sleep("500 millis");
      const before = sessions();
      expect(before).toBe(2);
      // A pick now answers from what was kept, without opening a session.
      expect(yield* tools.listEfforts("opencode", null, "provider/model-a")).toEqual(["none", "high"]);
      expect(sessions()).toBe(before);
    }).pipe(Effect.provide(liveHarnessToolsLayer({ claude: "claude", codex: "codex", opencode: command })));
  });

  it.live("reads an OpenCode account's Go plan limits from its own local API, once, in three windows", () => {
    const { layer, logged } = withHarnesses();
    return Effect.gen(function* () {
      const own = () =>
        call({ _tag: "ReadAccountBudgets" }).pipe(
          Effect.map((budgets) => budgets.find((budget) => budget.harness === "opencode" && budget.accountId === null)),
        );
      yield* own();
      let reading = yield* own();
      for (let attempt = 0; attempt < 100 && (reading?.planLimits ?? null) === null; attempt++) {
        yield* Effect.sleep("50 millis");
        reading = yield* own();
      }
      expect(reading?.planLimits?.windows).toEqual([
        { label: "5-hour", resetsAt: 1794481927000, usedPercent: 12 },
        { label: "Weekly", resetsAt: 1794787200000, usedPercent: 40 },
        { label: "Monthly", resetsAt: 1796315927000, usedPercent: 7 },
      ]);
      yield* own();
      yield* own();
      expect(logged().filter((entry) => entry.method === "usage/limits")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  for (const [reason, mode] of [
    ["is not signed in to its Console", "none"],
    ["cannot answer", "fail"],
  ] as const) {
    it.live(`shows no OpenCode plan limits when it ${reason}, and does not ask again at once`, () => {
      process.env.STAND_IN_OPENCODE_LIMITS = mode;
      const { layer, logged } = withHarnesses();
      return Effect.gen(function* () {
        for (let attempt = 0; attempt < 6; attempt++) {
          yield* call({ _tag: "ReadAccountBudgets" });
          yield* Effect.sleep("150 millis");
        }
        expect(logged().filter((entry) => entry.method === "usage/limits")).toHaveLength(1);
        const own = (yield* call({ _tag: "ReadAccountBudgets" })).find(
          (budget) => budget.harness === "opencode" && budget.accountId === null,
        );
        expect(own?.planLimits).toBeNull();
      }).pipe(Effect.provide(layer));
    });
  }

  it.live("loads its session again after an idle close, without saving the replayed conversation", () => {
    const { layer, requests } = withHarnesses("50 millis");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      yield* sendTo(started.threadId, "two");
      const detail = yield* settle(started.missionId, idleWith(2));
      expect(replies(detail)).toEqual(["Echo: one ", "Echo: two "]);
      expect(requests("session/load")[0]?.params?.sessionId).toMatch(/^ses-\d+$/);
    }).pipe(Effect.provide(layer));
  });

  it.live("cancels an interrupted prompt and counts the usage OpenCode reports for it", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "slow 5000" });
      yield* settle(started.missionId, (detail) => detail.thread.state === "Running");
      yield* untilRequested(requests, "session/prompt");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      expect(replies(detail)).toEqual([]);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
    }).pipe(Effect.provide(layer));
  });
});
