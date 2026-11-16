import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { writeOwnerMarker } from "../../src/harness/openCodeSandbox.ts";
import { isOpenCodeCommand, readMarkedProcesses } from "../../src/harness/processTree.ts";
import { listOpenCodeEfforts } from "../../src/index.ts";
import { call, sendTo, settle, startMission, temporary } from "../fixtures/service.ts";
import {
  acpPidsOf,
  answerOpen,
  idleWith,
  isAlive,
  realHomes,
  replies,
  seatbeltIn,
  withHarnesses,
} from "../fixtures/standIns.ts";
import { canApplySeatbelt, canReadProcessTable } from "../support/environment.ts";

const spawnChild = join(import.meta.dirname, "..", "fixtures", "stand-in-spawn-child.mjs");
describe("running OpenCode inside Seatbelt", () => {
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
});
