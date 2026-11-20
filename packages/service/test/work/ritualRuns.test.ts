import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { claude, codex, create, daily, isIdle, readRitual, replies, run, withService } from "../fixtures/rituals.ts";
import { call, read, settle } from "../fixtures/service.ts";

describe("creating a Ritual", () => {
  it.live("makes a quest of its own that waits for a run, listed with the Rituals and not with the quests", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const detail = yield* read(created.missionId);
        expect(detail.messages).toEqual([]);
        expect(detail.thread.title).toBe("Morning digest");
        const ritual = yield* readRitual(created.missionId);
        expect(ritual).toMatchObject({
          instruction: "runner",
          isOn: true,
          lastRunAt: null,
          primary: claude,
          schedule: daily,
        });
        expect(ritual?.nextRunAt).toBeGreaterThan(Date.now());
        // A Ritual is not a quest: it is listed with the Rituals, and its quest stays off the quest lists.
        const { missions } = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        expect(missions.map((mission) => mission.id)).not.toContain(created.missionId);
        const rituals = yield* call({ _tag: "ListRituals" });
        expect(rituals.map((listed) => listed.id)).toEqual([created.ritualId]);
        expect(rituals[0]).toMatchObject({ isOn: true, lastRunState: null, schedule: daily, title: "Morning digest" });
      }),
    ),
  );

  it.live("starts the quest's thread on the Ritual's primary Companion", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const detail = yield* read(created.missionId);
        expect(detail.thread).toMatchObject({ harness: "claude", model: "claude-sonnet-5-5" });
      }),
    ),
  );
});

describe("running a Ritual by hand", () => {
  it.live("sends the instruction to the main thread under its trigger, whatever the switch", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const ritual = yield* readRitual(created.missionId);
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [],
          instruction: "runner",
          isOn: false,
          primary: claude,
          ritualId: created.ritualId,
          schedule: daily,
          title: "Morning digest",
        });
        yield* run(created);
        const detail = yield* settle(created.missionId, (current) => replies(current).length === 1 && isIdle(current));
        expect(detail.messages[0]?.text).toContain("Ritual · run by you");
        expect(replies(detail)[0]).toBe("Echo: claude/claude-sonnet-5-5/default/session none");
        const after = yield* readRitual(created.missionId);
        expect(after).toMatchObject({ isOn: false, lastRunState: "Done", nextRunAt: null });
        expect(after?.lastRunAt).not.toBeNull();
        expect(ritual?.id).toBe(created.ritualId);
      }),
    ),
  );

  it.live("is refused while the previous run is still in a turn", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("wait 400");
        yield* run(created);
        const refusal = yield* run(created).pipe(Effect.flip);
        expect(refusal.kind).toBe("InvalidInput");
        expect(refusal.message).toContain("still running");
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Underway");
      }),
    ),
  );

  it.live("records an interrupted run and accepts another run after Stop", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("wait 60000");
        yield* run(created);
        yield* settle(created.missionId, (detail) => detail.thread.state === "Underway");
        yield* call({ _tag: "StopThread", threadId: created.threadId });
        expect((yield* read(created.missionId)).thread.state).toBe("Resting");
        expect(yield* readRitual(created.missionId)).toMatchObject({ lastRunState: "Interrupted" });
        yield* run(created);
        expect(yield* readRitual(created.missionId)).toMatchObject({ lastRunState: "Underway" });
      }),
    ),
  );
});

describe("falling back to another Companion", () => {
  it.live("passes over the thread's own Companion and hands the run to the next one", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude Usage limit reached\nrunner", { fallbacks: [claude, codex] });
        yield* run(created);
        const detail = yield* settle(created.missionId, (current) => replies(current).length === 1 && isIdle(current));
        expect(replies(detail)).toEqual(["Echo: codex/gpt-5/default/session none"]);
        expect(detail.handovers.map((handover) => handover.text)).toEqual([
          expect.stringMatching(/^Fell back to Codex · gpt-5 · default effort · Usage limit reached/),
        ]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );

  it.live("passes over a fallback on a removed account and hands the run to the next one", () =>
    withService(
      Effect.gen(function* () {
        const accounts = yield* call({ _tag: "AddAccount", harness: "claude", label: "Work" });
        const accountId = accounts.harnesses.find((harness) => harness.name === "claude")?.accounts[1]?.id;
        if (accountId === undefined || accountId === null) return yield* Effect.die("Missing added account");
        const created = yield* create("fail claude Usage limit reached\nrunner", {
          fallbacks: [{ ...claude, accountId }, codex],
        });
        yield* call({ _tag: "RemoveAccount", accountId });
        yield* run(created);
        const detail = yield* settle(created.missionId, (current) => replies(current).length === 1 && isIdle(current));
        expect(replies(detail)).toEqual(["Echo: codex/gpt-5/default/session none"]);
        expect(detail.handovers.map((handover) => handover.text)).toEqual([
          expect.stringMatching(/^Fell back to Codex · gpt-5 · default effort · Usage limit reached/),
        ]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );

  it.live("hands the failed run to the next Companion, says so in the quest, and finishes there", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude Usage limit reached\nrunner", { fallbacks: [codex] });
        yield* run(created);
        const detail = yield* settle(created.missionId, (current) => replies(current).length === 1 && isIdle(current));
        expect(replies(detail)[0]).toBe("Echo: codex/gpt-5/default/session none");
        expect(detail.handovers.map((handover) => handover.text)).toEqual([
          expect.stringMatching(/^Fell back to Codex · gpt-5 · default effort · Usage limit reached/),
        ]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );

  it.live("fails the run once every Companion has failed", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude no\nfail codex no", { fallbacks: [codex] });
        yield* run(created);
        yield* settle(created.missionId, (current) => current.thread.state === "Failed");
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Failed");
      }),
    ),
  );

  it.live("starts the next run on the primary Companion again", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude no\nrunner", { fallbacks: [codex] });
        yield* run(created);
        yield* settle(created.missionId, (current) => replies(current).length === 1 && isIdle(current));
        yield* call({
          _tag: "UpdateRitual",
          fallbacks: [codex],
          instruction: "runner",
          isOn: true,
          primary: claude,
          ritualId: created.ritualId,
          schedule: daily,
          title: "Morning digest",
        });
        yield* run(created);
        const detail = yield* settle(created.missionId, (current) => replies(current).length === 2 && isIdle(current));
        expect(replies(detail)[1]).toMatch(/^Echo: claude\/claude-sonnet-5-5\/default\/session none/);
      }),
    ),
  );
});
