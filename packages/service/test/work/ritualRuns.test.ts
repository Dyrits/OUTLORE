import { describe, expect, it } from "@effect/vitest";
import type { MissionId } from "@outlore/contracts";
import { Effect } from "effect";
import {
  claude,
  codex,
  create,
  daily,
  isIdle,
  readRitual,
  replies,
  run,
  runErrandOf,
  withService,
} from "../fixtures/rituals.ts";
import { call, read, settle } from "../fixtures/service.ts";

// A Ritual is an entity of its realm (CHG-0616): each run opens an errand beneath it, and its conversation — the top
// thread's message list — is the run history: the trigger line, then the result line. No thread takes a turn at its top.

/** Reads the running errand's conversation through the service. */
const errandRead = (missionId: MissionId, detail: Parameters<typeof runErrandOf>[0]) => {
  const errand = runErrandOf(detail);
  if (errand === null) return Effect.die(new Error("No run errand beneath the Ritual."));
  return read(missionId, errand.id);
};

describe("creating a Ritual", () => {
  it.live("makes an entity of its realm that waits for its run, listed with the Rituals and not with the quests", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        const detail = yield* read(created.missionId);
        expect(detail.messages).toEqual([]);
        expect(detail.thread.title).toBe("Morning digest");
        expect(detail.thread.state).toBe("Resting");
        const ritual = yield* readRitual(created.missionId);
        expect(ritual).toMatchObject({
          instruction: "runner",
          isOn: true,
          lastRunAt: null,
          originMissionId: null,
          primary: claude,
          schedule: daily,
        });
        expect(ritual?.nextRunAt).toBeGreaterThan(Date.now());
        // A Ritual is not a quest: the quest lists keep it out until they ask for the realm's Rituals too.
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
        expect(rituals[0]).toMatchObject({
          isOn: true,
          lastRunState: null,
          missionId: created.missionId,
          originMissionId: null,
          schedule: daily,
          title: "Morning digest",
        });
      }),
    ),
  );
});

describe("running a Ritual by hand", () => {
  it.live("opens an errand beneath the Ritual with the trigger plus the instruction, on its primary Companion", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        yield* run(created);
        const settled = yield* settle(created.missionId, (detail) => {
          const errand = runErrandOf(detail);
          return errand !== null && errand.state === "Resting";
        });
        const errand = runErrandOf(settled);
        if (errand === null) return yield* Effect.die("No errand");
        expect(errand).toMatchObject({ harness: "claude", model: "claude-sonnet-5-5", parentId: created.threadId });

        const errandDetail = yield* read(created.missionId, errand.id);
        expect(errandDetail.messages[0]).toMatchObject({ sender: "user" });
        expect(errandDetail.messages[0]?.text).toContain("Ritual · run by you");
        expect(errandDetail.messages[0]?.text).toContain("runner");
        expect(replies(errandDetail)).toEqual(["Echo: claude/claude-sonnet-5-5/default/session none"]);
      }),
    ),
  );

  it.live("keeps the run history in the Ritual's conversation, and its top thread never takes a turn", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("runner");
        yield* run(created);
        const settled = yield* settle(created.missionId, (detail) => {
          const errand = runErrandOf(detail);
          return errand !== null && errand.state === "Resting";
        });
        const errand = runErrandOf(settled);
        if (errand === null) return yield* Effect.die("No errand");

        const detail = yield* settle(created.missionId, (current) => current.messages.length >= 2 && isIdle(current));
        expect(detail.thread.state).toBe("Resting");
        expect(detail.messages[0]).toMatchObject({ sender: "user" });
        expect(detail.messages[0]?.text).toBe("Ritual · run by you");
        expect(detail.messages[1]?.text).toBe(`Result from thread "Ritual · run by you" (${errand.id}): Done`);

        const ritual = yield* readRitual(created.missionId);
        expect(ritual).toMatchObject({ lastRunState: "Done" });
        expect(ritual?.lastRunAt).not.toBeNull();
      }),
    ),
  );

  it.live("is refused while the previous run's errand is still at work", () =>
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
        const underway = yield* settle(created.missionId, (detail) => {
          const errand = runErrandOf(detail);
          return errand !== null && errand.state === "Underway";
        });
        const errand = runErrandOf(underway);
        if (errand === null) return yield* Effect.die("No errand");
        yield* call({ _tag: "StopThread", threadId: errand.id });
        yield* settle(created.missionId, (current) => current.messages.length >= 2);
        expect(yield* readRitual(created.missionId)).toMatchObject({ lastRunState: "Interrupted" });
        const detail = yield* read(created.missionId);
        expect(detail.thread.state).toBe("Resting");
        expect(detail.messages[1]?.text).toBe(`Result from thread "Ritual · run by you" (${errand.id}): Interrupted`);

        yield* run(created);
        yield* settle(created.missionId, (current) => {
          const errands = current.threads.filter(
            (thread) => thread.parentId === current.mission.topThreadId && thread.isAside === false,
          );
          return errands.some((each) => each.state === "Underway");
        });
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Underway");
      }),
    ),
  );
});

describe("falling back to another Companion", () => {
  it.live("passes over the errand's own Companion and hands the run to the next one", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude Usage limit reached\nrunner", { fallbacks: [claude, codex] });
        yield* run(created);
        const settled = yield* settle(created.missionId, (detail) => {
          const errand = runErrandOf(detail);
          return errand !== null && errand.state === "Resting";
        });
        const errandDetail = yield* errandRead(created.missionId, settled);
        expect(replies(errandDetail)).toEqual(["Echo: codex/gpt-5/default/session none"]);
        expect(errandDetail.handovers.map((handover) => handover.text)).toEqual([
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
        const settled = yield* settle(created.missionId, (detail) => {
          const errand = runErrandOf(detail);
          return errand !== null && errand.state === "Resting";
        });
        const errandDetail = yield* errandRead(created.missionId, settled);
        expect(replies(errandDetail)).toEqual(["Echo: codex/gpt-5/default/session none"]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );

  it.live("fails the run once every Companion has failed, and says so in its own words", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude no\nfail codex no", { fallbacks: [codex] });
        yield* run(created);
        const failed = yield* settle(created.missionId, (detail) => {
          const errand = runErrandOf(detail);
          return errand !== null && errand.state === "Failed";
        });
        const errandDetail = yield* errandRead(created.missionId, failed);
        expect(errandDetail.thread.state).toBe("Failed");
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Failed");
      }),
    ),
  );

  it.live("starts the next run on the primary Companion again", () =>
    withService(
      Effect.gen(function* () {
        const created = yield* create("fail claude no\nrunner", { fallbacks: [codex] });
        yield* run(created);
        const first = yield* settle(created.missionId, (detail) => {
          const errand = runErrandOf(detail);
          return errand !== null && errand.state === "Resting";
        });
        const firstDetail = yield* errandRead(created.missionId, first);
        expect(replies(firstDetail)).toEqual(["Echo: codex/gpt-5/default/session none"]);

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
        const second = yield* settle(created.missionId, (detail) => {
          const errands = detail.threads.filter(
            (thread) => thread.parentId === detail.mission.topThreadId && thread.isAside === false,
          );
          return errands.length === 2 && errands.every((each) => each.state === "Resting");
        });
        const [firstErrand, secondErrand] = second.threads.filter(
          (thread) => thread.parentId === second.mission.topThreadId && thread.isAside === false,
        );
        if (firstErrand === undefined || secondErrand === undefined) return yield* Effect.die("Missing errands");
        const secondDetail = yield* read(created.missionId, secondErrand.id);
        expect(replies(secondDetail)).toEqual(["Echo: claude/claude-sonnet-5-5/default/session none"]);
        expect((yield* readRitual(created.missionId))?.lastRunState).toBe("Done");
      }),
    ),
  );
});
