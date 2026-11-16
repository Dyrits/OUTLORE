import { spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { writeOwnerMarker } from "../../src/harness/openCodeSandbox.ts";
import { isOpenCodeCommand, readMarkedProcesses } from "../../src/harness/processTree.ts";
import { HarnessTools, listOpenCodeEfforts, liveHarnessToolsLayer } from "../../src/index.ts";
import { call, sendTo, settle, startMission, temporary } from "../fixtures/service.ts";
import {
  acpPidsOf,
  answerOpen,
  attachedPng,
  idleWith,
  isAlive,
  linkedFolders,
  linkInPlace,
  openQuestionOf,
  pngBytes,
  realHomes,
  replies,
  seatbeltIn,
  untilRequested,
  withHarnesses,
} from "../fixtures/standIns.ts";
import { canApplySeatbelt, canReadProcessTable } from "../support/environment.ts";

const standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs")];
const spawnChild = join(import.meta.dirname, "..", "fixtures", "stand-in-spawn-child.mjs");

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

  it.live("carries on in the same turn after the owner's refusal cancels OpenCode's prompt", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run git push origin main" });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        "Echo: Outlore refused the command `git push origin main`. Not approved by the owner. Do not do this action; carry on without it. ",
      ]);
      expect(requests("session/prompt")).toHaveLength(2);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 80, input: 180, output: 16 });
    }).pipe(Effect.provide(layer));
  });

  it.live("gives OpenCode the owner's message with a refusal", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: `edit ${outside}` });
      yield* answerOpen("Deny", "Write it in the notes folder instead.");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        `Echo: Outlore refused the change to \`${outside}\`. Denied by the owner: Write it in the notes folder instead. `,
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks about the file outside the folder when one edit names a file inside and one outside", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: `edit inside.txt and ${outside}` });
      const detail = yield* settle(started.missionId, (current) => current.questions.length === 1);
      expect(detail.questions[0]?.details).toContain(outside);
      expect(detail.questions[0]?.outcome).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("sends no refusal after an interrupt cancels a prompt waiting on a question", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run git push origin main" });
      yield* settle(started.missionId, (detail) => detail.questions.length === 1);
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      yield* Effect.sleep("200 millis");
      expect(replies(detail)).toEqual([]);
      expect(requests("session/prompt")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the usage of a turn's earlier prompts when OpenCode exits during an interrupt", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "fragile run git push origin main" });
      yield* answerOpen("Deny");
      for (let attempt = 0; attempt < 100 && requests("session/prompt").length < 2; attempt++)
        yield* Effect.sleep("10 millis");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
    }).pipe(Effect.provide(layer));
  });

  it.live("lets an edit inside the thread's folder run without a question", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "edit notes/plan.md" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["notes/plan.md: once "]);
      expect(detail.questions).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner before an edit outside the thread's folder", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: `edit ${outside}` });
      const answered = yield* answerOpen("Deny");
      expect(answered.details).toBe(`Edit ${outside}\n${JSON.stringify({ file_path: outside }, null, 2)}`);
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        `Echo: Outlore refused the change to \`${outside}\`. Not approved by the owner. Do not do this action; carry on without it. `,
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner before a relative edit that climbs out of the thread's folder", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "edit ../../outside.txt" });
      yield* answerOpen("Allow");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["../../outside.txt: once "]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks before every command when no sandbox protects OpenCode, naming it exactly", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run ls" });
      const answered = yield* answerOpen("Allow");
      expect(answered).toMatchObject({ details: "ls", permission: "Run without a sandbox" });
      expect(replies(yield* settle(started.missionId, idleWith(1)))).toEqual(["ls: once "]);
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(!canApplySeatbelt)(
    "runs OpenCode inside Seatbelt: commands go unasked, and writes land only in its folders",
    () => {
      const real = realHomes();
      const { directory, layer, logged } = withHarnesses("10 minutes", seatbeltIn(real));
      const elsewhere = realpathSync(temporary("outlore-elsewhere-"));
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "run ls" });
        const detail = yield* settle(started.missionId, idleWith(1));
        expect(replies(detail)).toEqual(["ls: once "]);
        expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
        const xdg = logged().find((entry) => entry.pid !== undefined)?.xdg;
        // Its data too is the service's copy for this computer's account, never OpenCode's own data folder.
        expect(xdg).toEqual({
          cache: join(directory, "opencode-sandbox", "cache"),
          config: join(directory, "opencode-sandbox", "config"),
          data: join(directory, "opencode-sandbox", "data", "computer"),
          state: join(directory, "opencode-sandbox", "state"),
          tmp: join(directory, "opencode-sandbox", "tmp"),
        });
        const send = (text: string, count: number) =>
          Effect.gen(function* () {
            yield* sendTo(started.threadId, text);
            return replies(yield* settle(started.missionId, idleWith(count))).at(-1);
          });
        const outside = join(elsewhere, "outside.txt");
        expect(yield* send(`write ${outside}`, 2)).toBe(`${outside}: EPERM `);
        expect(existsSync(outside)).toBe(false);
        // A file planted for OpenCode runs outside the sandbox cannot reach its real data folder; the copy takes it,
        // and it never shows in the real folder.
        mkdirSync(join(real, "share", "opencode", "bin"), { recursive: true });
        const planted = join(real, "share", "opencode", "bin", "rg");
        expect(yield* send(`write ${planted}`, 3)).toBe(`${planted}: EPERM `);
        const copied = join(directory, "opencode-sandbox", "data", "computer", "opencode", "plugin.js");
        expect(yield* send(`write ${copied}`, 4)).toBe(`${copied}: written `);
        expect(existsSync(planted)).toBe(false);
        expect(existsSync(join(real, "share", "opencode", "plugin.js"))).toBe(false);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)(
    "asks, as for an escape, when no executor descends from the wrapped OpenCode",
    () => {
      // An `acp` that serves from a process outside its own tree (an existing daemon) is not contained by the wrapper.
      process.env.STAND_IN_OPENCODE_EXECUTOR = "none";
      const { layer } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "run ls" });
        const answered = yield* answerOpen("Deny");
        expect(answered).toMatchObject({ details: "ls", permission: "Run outside the sandbox" });
        yield* settle(started.missionId, idleWith(1));
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)(
    "asks before an edit inside the folder too when containment cannot be confirmed",
    () => {
      process.env.STAND_IN_OPENCODE_EXECUTOR = "none";
      const { layer } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "edit notes/plan.md" });
        const answered = yield* answerOpen("Deny");
        expect(answered.permission).toBe("Change a file outside the workspace");
        yield* settle(started.missionId, idleWith(1));
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)(
    "seeds its data copy from the real folder at each start, while the probes keep reading the real folder",
    () => {
      const real = realHomes();
      const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(real));
      const copy = join(directory, "opencode-sandbox", "data", "computer");
      const exportsFrom = (data: string) =>
        logged().filter((entry) => entry.auth === "export" && entry.data === data).length;
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "one" });
        yield* settle(started.missionId, idleWith(1));
        expect([exportsFrom(join(real, "share")), exportsFrom(copy)]).toEqual([1, 1]);
        // Closed when idle, then started again for the next message: seeded again.
        yield* Effect.sleep("200 millis");
        yield* sendTo(started.threadId, "two");
        yield* settle(started.missionId, idleWith(2));
        expect([exportsFrom(join(real, "share")), exportsFrom(copy)]).toEqual([2, 2]);

        // The plan-limit probe runs outside the sandbox on the account's real folder, as the owner's OpenCode does.
        for (let attempt = 0; attempt < 100 && !logged().some((entry) => entry.method === "usage/limits"); attempt++) {
          yield* call({ _tag: "ReadAccountBudgets" });
          yield* Effect.sleep("50 millis");
        }
        const probe = logged().find((entry) => entry.pid !== undefined && entry.args?.includes("serve"));
        expect(probe?.home).toBe(process.env.XDG_DATA_HOME ?? null);
        expect(probe?.xdg?.config).toBe(process.env.XDG_CONFIG_HOME ?? null);
        // So does the effort probe, here for an added account's folder.
        const account = join(real, "accounts", "work");
        yield* listOpenCodeEfforts(process.execPath, account, "provider/model-a", [
          join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs"),
        ]);
        expect(
          logged()
            .filter((entry) => entry.pid !== undefined)
            .at(-1)?.home,
        ).toBe(account);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)("ends an executor that outlived its `acp`, found by the service's marker", () => {
    process.env.STAND_IN_OPENCODE_EXECUTOR = "survivor";
    const { layer, logged } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
    let executor = -1;
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      executor = logged().find((entry) => entry.executor !== undefined)?.executor ?? -1;
      const acp = logged().find((entry) => entry.pid !== undefined && entry.args?.includes("acp"))?.pid ?? -1;
      expect(isAlive(executor)).toBe(true);
      // `acp` dies alone, before anything reads its tree: its executor is an orphan in a group of its own.
      process.kill(acp, "SIGKILL");
      for (let attempt = 0; attempt < 200 && isAlive(executor); attempt++) yield* Effect.sleep("25 millis");
      expect(isAlive(executor)).toBe(false);
    }).pipe(
      Effect.ensuring(Effect.sync(() => executor > 0 && isAlive(executor) && process.kill(executor, "SIGKILL"))),
      Effect.provide(layer),
    );
  });

  it.live.skipIf(!canApplySeatbelt)("leaves no marked OpenCode process after a normal close", () => {
    const real = realHomes();
    const { directory, layer, logged } = withHarnesses("100 millis", seatbeltIn(real));
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "Hello" });
      yield* settle(started.missionId, idleWith(1));
      const executor = logged().find((entry) => entry.executor !== undefined)?.executor ?? -1;
      const marker = writeOwnerMarker(seatbeltIn(real)(directory));
      expect(readMarkedProcesses(marker).map((found) => found.pid)).toContain(executor);
      for (let attempt = 0; attempt < 200 && isAlive(executor); attempt++) yield* Effect.sleep("25 millis");
      expect(isAlive(executor)).toBe(false);
      expect(readMarkedProcesses(marker).filter((found) => isOpenCodeCommand(found.command))).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(!canApplySeatbelt)("ends, when the service starts, the OpenCode processes an earlier run lost", () => {
    const real = realHomes();
    const { directory, layer } = withHarnesses("10 minutes", seatbeltIn(real));
    const marker = writeOwnerMarker(seatbeltIn(real)(directory));
    const pidFile = join(directory, "lost");
    // A parent that leaves a marked executor behind, as a service that stopped would.
    spawn(process.execPath, [spawnChild, pidFile, "exit", "serve", "--stdio"], {
      env: { ...process.env, [marker.name]: marker.value },
      stdio: "ignore",
    });
    let lost = -1;
    return Effect.gen(function* () {
      for (let attempt = 0; attempt < 200 && !existsSync(pidFile); attempt++) yield* Effect.sleep("25 millis");
      lost = Number(readFileSync(pidFile, "utf8"));
      yield* Effect.sleep("200 millis");
      expect(isAlive(lost)).toBe(true);
      // The OpenCode adapter is made with the service: it ends the lost process before any thread starts.
      yield* Effect.provide(call({ _tag: "ListHarnesses" }), layer);
      for (let attempt = 0; attempt < 200 && isAlive(lost); attempt++) yield* Effect.sleep("25 millis");
      expect(isAlive(lost)).toBe(false);
    }).pipe(Effect.ensuring(Effect.sync(() => lost > 0 && isAlive(lost) && process.kill(lost, "SIGKILL"))));
  });

  it.live.runIf(canReadProcessTable)(
    "ends OpenCode's whole process tree when it closes, a child in its own process group included",
    () => {
      const { layer, logged } = withHarnesses("100 millis");
      process.env.STAND_IN_OPENCODE_CHILD = "1";
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "Hello" });
        yield* settle(started.missionId, idleWith(1));
        const grandchild = logged().find((entry) => entry.grandchild !== undefined)?.grandchild ?? -1;
        expect(grandchild).toBeGreaterThan(0);
        for (let attempt = 0; attempt < 200 && isAlive(grandchild); attempt++) yield* Effect.sleep("25 millis");
        expect(isAlive(grandchild)).toBe(false);
      }).pipe(Effect.provide(layer));
    },
  );

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

  it.live.skipIf(!canApplySeatbelt)(
    "starts a new session, and says so in the thread, when a sandboxed OpenCode cannot load the earlier one",
    () => {
      const { layer, logged, requests } = withHarnesses("50 millis", seatbeltIn(realHomes()));
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "one" });
        yield* settle(started.missionId, idleWith(1));
        // The earlier session lives where the sandbox's copy does not have it.
        const earlier = `ses-${acpPidsOf(logged)[0]}`;
        process.env.STAND_IN_OPENCODE_MISSING_SESSIONS = earlier;
        yield* Effect.sleep("200 millis");
        yield* sendTo(started.threadId, "two");
        const detail = yield* settle(started.missionId, idleWith(2));
        expect(replies(detail)).toEqual(["Echo: one ", "Echo: two "]);
        expect(requests("session/load").map((request) => request.params?.sessionId)).toEqual([earlier]);
        expect(requests("session/new")).toHaveLength(2);
        expect(detail.thread.failure).toBeNull();
        expect(detail.handovers.map((line) => line.text)).toEqual([expect.stringContaining("could not pick up")]);
        expect(detail.handovers[0]?.text).toContain("handover notes");
        // The new session's first prompt carries the thread's conversation so far, then the turn's own message.
        const replacing = `ses-${acpPidsOf(logged)[1]}`;
        const promptsOf = (sessionId: string) =>
          requests("session/prompt")
            .filter((request) => request.params?.sessionId === sessionId)
            .map((request) => JSON.stringify(request.params?.prompt));
        const [first] = promptsOf(replacing);
        expect(first).toContain("Conversation so far");
        expect(first).toContain("The owner: one");
        expect(first).toContain("You: Echo: one");
        expect(first?.indexOf("Conversation so far")).toBeLessThan(first?.lastIndexOf("two") ?? -1);
        // The new session replaced the earlier one: the next start loads it, with no new note.
        yield* Effect.sleep("200 millis");
        yield* sendTo(started.threadId, "three");
        const after = yield* settle(started.missionId, idleWith(3));
        expect(requests("session/load").map((request) => request.params?.sessionId)).toEqual([earlier, replacing]);
        expect(requests("session/new")).toHaveLength(2);
        expect(after.handovers).toHaveLength(1);
        // The loaded session remembers: its later prompts carry no conversation again.
        expect(promptsOf(replacing).slice(1).join("")).not.toContain("Conversation so far");
      }).pipe(Effect.provide(layer));
    },
  );

  it.live("still fails the turn when an unsandboxed OpenCode cannot load its session", () => {
    const { layer, logged, requests } = withHarnesses("50 millis");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      process.env.STAND_IN_OPENCODE_MISSING_SESSIONS = `ses-${acpPidsOf(logged)[0]}`;
      yield* Effect.sleep("200 millis");
      yield* sendTo(started.threadId, "two");
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
      expect(detail.thread.failure).toContain("Session not found");
      expect(requests("session/new")).toHaveLength(1);
      expect(detail.handovers).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live(
    "asks before an edit in a folder that is a link when no sandbox tool exists, without asking about the start",
    () => {
      const { layer } = withHarnesses("50 millis");
      const { elsewhere, workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "one", workspacePath: workspace });
        yield* settle(started.missionId, idleWith(1));
        yield* Effect.sleep("200 millis");
        linkInPlace(workspace, elsewhere);
        yield* sendTo(started.threadId, "edit notes/plan.md");
        // The only question is the edit's: nothing is sandboxed, so there is no start to ask about.
        const edit = yield* answerOpen("Deny");
        expect(edit.permission).toBe("Change a file outside the workspace");
        yield* settle(started.missionId, idleWith(2));
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)(
    "asks before running a thread whose workspace folder became a link, then runs it unsandboxed, asking per action",
    () => {
      const { layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
      const { elsewhere, workspace } = linkedFolders();
      return Effect.gen(function* () {
        const started = yield* startMission({ harness: "opencode", text: "one", workspacePath: workspace });
        yield* settle(started.missionId, idleWith(1));
        yield* Effect.sleep("200 millis");
        linkInPlace(workspace, elsewhere);
        yield* sendTo(started.threadId, "run ls");
        // A boundary anomaly: each start asks, and the question offers no standing permission (no Always allow).
        const open = yield* openQuestionOf();
        expect(open).toMatchObject({ pattern: null, permission: null });
        const refused = yield* Effect.flip(
          call({ _tag: "AnswerQuestion", answer: "AlwaysAllow", message: null, questionId: open.id }),
        );
        expect(refused.message).toContain("one-time");
        const asked = yield* answerOpen("Allow");
        expect(asked.outcome).toBe("Allowed");
        expect((yield* call({ _tag: "ReadPermissions", missionId: null })).permissions).toEqual([]);
        expect(asked.summary).toContain(workspace);
        expect(asked.summary).toContain(elsewhere);
        expect(asked.summary).toContain("write outside the workspace");
        // Allowed: OpenCode runs where the link points, with no sandbox, and every command asks.
        const command = yield* answerOpen("Allow");
        expect(command).toMatchObject({ details: "ls", permission: "Run without a sandbox" });
        expect(replies(yield* settle(started.missionId, idleWith(2))).at(-1)).toBe("ls: once ");
        const unwrapped = logged().filter((entry) => entry.pid !== undefined && entry.args?.includes("acp"))[1];
        expect(unwrapped?.xdg?.data).toBe(process.env.XDG_DATA_HOME ?? null);
      }).pipe(Effect.provide(layer));
    },
  );

  it.live.skipIf(!canApplySeatbelt)("asks before an edit inside the linked folder once running unsandboxed", () => {
    const { layer } = withHarnesses("50 millis", seatbeltIn(realHomes()));
    const { elsewhere, workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "one", workspacePath: workspace });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      linkInPlace(workspace, elsewhere);
      yield* sendTo(started.threadId, "edit notes/plan.md");
      yield* answerOpen("Allow");
      const edit = yield* answerOpen("Deny");
      expect(edit.permission).toBe("Change a file outside the workspace");
      yield* settle(started.missionId, idleWith(2));
    }).pipe(Effect.provide(layer));
  });

  for (const [label, target] of [
    ["the whole disk", () => "/"],
    ["a folder outside the scratch root", () => linkedFolders().elsewhere],
  ] as const)
    it.live.skipIf(!canApplySeatbelt)(
      `fails the turn with the reason when the owner refuses a scratch folder linked to ${label}`,
      () => {
        const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
        const pointed = target();
        return Effect.gen(function* () {
          const started = yield* startMission({ harness: "opencode", text: "one" });
          yield* settle(started.missionId, idleWith(1));
          yield* Effect.sleep("200 millis");
          const scratch = join(directory, "missions", started.missionId);
          linkInPlace(scratch, pointed);
          yield* sendTo(started.threadId, "two");
          const asked = yield* answerOpen("Deny");
          expect(asked.summary).toContain(scratch);
          expect(asked.summary).toContain(`points to ${pointed}`);
          const detail = yield* settle(started.missionId, (current) => current.thread.state === "Failed");
          expect(detail.thread.failure).toContain(scratch);
          expect(detail.thread.failure).toContain("outside the workspace");
          // No OpenCode started for the refused turn, sandboxed or not.
          expect(acpPidsOf(logged)).toHaveLength(1);
        }).pipe(Effect.provide(layer));
      },
    );

  it.live.skipIf(!canApplySeatbelt)("asks when the scratch root itself became a link", () => {
    const { directory, layer, logged } = withHarnesses("50 millis", seatbeltIn(realHomes()));
    const { elsewhere } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "one" });
      yield* settle(started.missionId, idleWith(1));
      yield* Effect.sleep("200 millis");
      const root = join(directory, "missions");
      renameSync(root, join(elsewhere, "missions"));
      symlinkSync(join(elsewhere, "missions"), root);
      yield* sendTo(started.threadId, "two");
      const asked = yield* answerOpen("Deny");
      expect(asked.summary).toContain(root);
      expect(asked.summary).toContain(join(elsewhere, "missions"));
      yield* settle(started.missionId, (current) => current.thread.state === "Failed");
      expect(acpPidsOf(logged)).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live.skipIf(!canApplySeatbelt)("runs a thread in a plain workspace folder sandboxed, asking nothing", () => {
    const { layer, logged } = withHarnesses("10 minutes", seatbeltIn(realHomes()));
    const { workspace } = linkedFolders();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run ls", workspacePath: workspace });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(detail.questions.map((question) => question.outcome)).toEqual(["AllowedAutomatically"]);
      const wrapped = logged().find((entry) => entry.pid !== undefined && entry.args?.includes("acp"));
      expect(wrapped?.cwd).toBe(workspace);
      expect(wrapped?.xdg?.data).not.toBe(process.env.XDG_DATA_HOME ?? null);
    }).pipe(Effect.provide(layer));
  });
});
