import { describe, expect, it } from "@effect/vitest";
import type { CreateRitualResult, MissionDetail, MissionId, RitualScopeEntry } from "@outlore/contracts";
import { Effect } from "effect";
import { claude, create, run, runErrandOf, withService } from "../fixtures/rituals.ts";
import { call, read, settle, start, tool } from "../fixtures/service.ts";

// A Ritual's reviewed scope (CHG-0208) grants its runs — errands beneath the Ritual (CHG-0616) — structural actions
// without asking. The questions a run asks live in its errand's conversation, not in the Ritual's own.

const openOf = (detail: MissionDetail) => detail.questions.filter((question) => question.outcome === null);
/** A resting quest named as given, for a Ritual to act on. */
const restingQuest = (title: string) =>
  Effect.gen(function* () {
    const quest = yield* start("Hello");
    yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting");
    yield* call({ _tag: "RenameMission", missionId: quest.missionId, title });
    return quest;
  });

const withScope = (instruction: string, scope: ReadonlyArray<RitualScopeEntry>) =>
  call({
    _tag: "CreateRitual",
    fallbacks: [],
    instruction,
    primary: claude,
    requestId: crypto.randomUUID(),
    schedule: { _tag: "Daily", time: "07:00" },
    scope,
    title: "Housekeeping",
    workspacePath: null,
  });

/** Runs the Ritual and waits until its errand waits in Attention — it asked the owner something. */
const runUntilAsked = (ritual: CreateRitualResult) =>
  Effect.gen(function* () {
    yield* run(ritual);
    const waiting = yield* settle(ritual.missionId, (detail) => {
      const errand = runErrandOf(detail);
      return errand !== null && errand.state === "Attention";
    });
    const errand = runErrandOf(waiting);
    if (errand === null) return yield* Effect.die("No run errand.");
    return errand.id;
  });

/** Runs the Ritual and waits until its errand rests; the questions it asked stay recorded among its own. */
const runErrandDetail = (ritual: CreateRitualResult) =>
  Effect.gen(function* () {
    yield* run(ritual);
    const settled = yield* settle(ritual.missionId, (detail) => {
      const errand = runErrandOf(detail);
      return errand !== null && errand.state !== "Underway" && errand.state !== "Attention";
    });
    const errand = runErrandOf(settled);
    if (errand === null) return yield* Effect.die("No run errand.");
    return yield* read(ritual.missionId, errand.id);
  });

describe("a Ritual's reviewed scope", () => {
  const archiveCall = (missionId: MissionId) =>
    `call act_on_mission ${JSON.stringify({ action: "Archive", mission: missionId })}`;

  it.live("is empty by default", () =>
    Effect.gen(function* () {
      const created = yield* create("Hello");
      expect((yield* call({ _tag: "ReadRitual", missionId: created.missionId }))?.scope).toEqual([]);
    }).pipe(withService),
  );

  it.live("lets a run take an action inside its scope without asking, and asks for one outside it", () =>
    Effect.gen(function* () {
      const inside = yield* restingQuest("Old notes");
      const outside = yield* restingQuest("Current plan");
      const created = yield* withScope(`${archiveCall(inside.missionId)}\n${archiveCall(outside.missionId)}`, [
        { operation: "Archive", payload: null, target: "Old notes" },
      ]);
      const errandId = yield* runUntilAsked(created);
      const asked = yield* read(created.missionId, errandId);
      expect((yield* read(inside.missionId)).mission.state).toBe("Archived");
      expect(asked.questions[0]).toMatchObject({
        outcome: "AllowedByPermission",
        summary: 'Archive the quest "Old notes".',
      });
      expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Current plan".');
      expect((yield* read(outside.missionId)).mission.state).not.toBe("Archived");
    }).pipe(withService),
  );

  it.live("never takes its instruction, the run's own message, as the owner's words", () =>
    Effect.gen(function* () {
      const quest = yield* restingQuest("Old notes");
      const created = yield* withScope(`Archive Old notes.\n${archiveCall(quest.missionId)}`, []);
      const errandId = yield* runUntilAsked(created);
      const asked = yield* read(created.missionId, errandId);
      expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Old notes".');
      expect((yield* read(quest.missionId)).mission.state).not.toBe("Archived");
    }).pipe(withService),
  );

  it.live("asks again in the next run once the owner revokes the scope", () =>
    Effect.gen(function* () {
      const quest = yield* restingQuest("Old notes");
      const created = yield* withScope(archiveCall(quest.missionId), [
        { operation: "Archive", payload: null, target: quest.missionId },
      ]);
      // The scope covers the archive: the run asks nothing and does it.
      const unasked = yield* runErrandDetail(created);
      expect(unasked.questions.some((question) => question.outcome === "AllowedByPermission")).toBe(true);
      expect((yield* read(quest.missionId)).mission.state).toBe("Archived");

      const ritual = yield* call({ _tag: "ReadRitual", missionId: created.missionId });
      if (ritual === null) return yield* Effect.die("Missing Ritual");
      const unfinished = yield* restingQuest("Current plan");
      yield* call({
        _tag: "UpdateRitual",
        ...ritual,
        instruction: archiveCall(unfinished.missionId),
        ritualId: ritual.id,
        scope: [],
      });
      expect((yield* call({ _tag: "ReadRitual", missionId: created.missionId }))?.scope).toEqual([]);
      const errandId = yield* runUntilAsked(created);
      const asked = yield* read(created.missionId, errandId);
      expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Current plan".');
      expect((yield* read(unfinished.missionId)).mission.state).not.toBe("Archived");
    }).pipe(withService),
  );

  it.live("changes a setting inside its scope unasked, and asks in the next run once that entry is revoked", () =>
    Effect.gen(function* () {
      const change = `call change_setting ${JSON.stringify({ setting: "shouldShowFinishedQuests", value: "true" })}`;
      const created = yield* withScope(change, [
        { operation: "ChangeSetting", payload: "true", target: "shouldShowFinishedQuests" },
      ]);
      const done = yield* runErrandDetail(created);
      expect(openOf(done)).toEqual([]);
      expect(done.questions.some((question) => question.outcome === "AllowedByPermission")).toBe(true);
      const after = yield* call({ _tag: "ReadSettings" });
      expect(after.shouldShowFinishedQuests).toBe(true);

      // The owner puts the setting back and takes the entry out of the scope: the same instruction now asks.
      const settings = yield* call({ _tag: "ReadSettings" });
      yield* call({
        _tag: "UpdateSettings",
        settings: { ...settings, shouldShowFinishedQuests: false },
      });
      const ritual = yield* call({ _tag: "ReadRitual", missionId: created.missionId });
      if (ritual === null) return yield* Effect.die("Missing Ritual");
      yield* call({ _tag: "UpdateRitual", ...ritual, ritualId: ritual.id, scope: [] });
      const errandId = yield* runUntilAsked(created);
      const asked = yield* read(created.missionId, errandId);
      expect(openOf(asked)[0]?.summary).toContain("shouldShowFinishedQuests");
      expect((yield* call({ _tag: "ReadSettings" })).shouldShowFinishedQuests).toBe(false);
    }).pipe(withService),
  );

  it.live("asks for an action its instruction names when the scope does not cover it", () =>
    Effect.gen(function* () {
      const named = yield* restingQuest("Old notes");
      const other = yield* restingQuest("Current plan");
      // The instruction names the quest in the owner's own words; only the reviewed scope counts, and it covers another.
      const created = yield* withScope(`Archive quest Old notes.\n${archiveCall(named.missionId)}`, [
        { operation: "Archive", payload: null, target: other.missionId },
      ]);
      const errandId = yield* runUntilAsked(created);
      const asked = yield* read(created.missionId, errandId);
      expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Old notes".');
      expect((yield* read(named.missionId)).mission.state).not.toBe("Archived");
    }).pipe(withService),
  );

  it.live("gives a run errand no other structural tool, and an ordinary quest's thread none", () =>
    Effect.gen(function* () {
      const quest = yield* restingQuest("Old notes");
      const created = yield* withScope("Hello", [{ operation: "Archive", payload: null, target: quest.missionId }]);
      const done = yield* runErrandDetail(created);
      const errandId = done.thread.id;
      expect(yield* tool(errandId, "create_realm", { name: "Ideas" })).toContain("Only Chronicler makes realms");
      expect(yield* tool(errandId, "rename_realm", { name: "Ideas", realm: "Borderlands" })).toContain(
        "Only Chronicler renames realms",
      );
      const settingArgs = { setting: "shouldShowFinishedQuests", value: "true" };
      expect(yield* tool(quest.threadId, "change_setting", settingArgs)).toContain(
        "Only Chronicler changes the settings",
      );
      expect(yield* tool(quest.threadId, "act_on_mission", { action: "Archive", mission: quest.missionId })).toContain(
        "Only Chronicler acts on quests",
      );
      expect((yield* call({ _tag: "ReadSettings" })).shouldShowFinishedQuests).toBe(false);
      expect((yield* read(quest.missionId)).mission.state).not.toBe("Archived");
    }).pipe(withService),
  );

  it.live("refuses a scope that is not exact, or that reaches a setting kept for the owner", () =>
    Effect.gen(function* () {
      const failureOf = (scope: ReadonlyArray<RitualScopeEntry>) => Effect.flip(withScope("Hello", scope));
      expect(
        (yield* failureOf([{ operation: "ChangeSetting", payload: '"Never"', target: "defaultPermissionMode" }])).kind,
      ).toBe("InvalidInput");
      expect((yield* failureOf([{ operation: "Rename", payload: null, target: "Old notes" }])).kind).toBe(
        "InvalidInput",
      );
      expect((yield* failureOf([{ operation: "Archive", payload: "x", target: "Old notes" }])).kind).toBe(
        "InvalidInput",
      );
      expect(
        (yield* failureOf([{ operation: "ChangeSetting", payload: "not json", target: "shouldShowFinishedQuests" }]))
          .kind,
      ).toBe("InvalidInput");
      expect(yield* call({ _tag: "ListRituals" })).toEqual([]);
    }).pipe(withService),
  );
});
