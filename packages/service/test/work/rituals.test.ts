import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail, MissionId, RitualScopeEntry } from "@outlore/contracts";
import { Effect } from "effect";
import { claude, create, daily, isIdle, readRitual, run, withService } from "../fixtures/rituals.ts";
import { call, read, send, settle, start, tool } from "../fixtures/service.ts";

describe("a Ritual's reviewed scope", () => {
  const archiveCall = (missionId: MissionId) =>
    `call act_on_mission ${JSON.stringify({ action: "Archive", mission: missionId })}`;
  const openOf = (detail: MissionDetail) => detail.questions.filter((question) => question.outcome === null);
  /** A resting quest for the Ritual to act on. */
  const restingQuest = (title: string) =>
    Effect.gen(function* () {
      const quest = yield* start("Hello");
      yield* settle(quest.missionId, isIdle);
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
      schedule: daily,
      scope,
      title: "Housekeeping",
      workspacePath: null,
    });

  it.live("is empty by default", () =>
    Effect.gen(function* () {
      const created = yield* create("Hello");
      expect((yield* readRitual(created.missionId))?.scope).toEqual([]);
    }).pipe(withService),
  );

  it.live("lets a run take an action inside its scope without asking, and asks for one outside it", () =>
    Effect.gen(function* () {
      const inside = yield* restingQuest("Old notes");
      const outside = yield* restingQuest("Current plan");
      const created = yield* withScope(`${archiveCall(inside.missionId)}\n${archiveCall(outside.missionId)}`, [
        { operation: "Archive", payload: null, target: "Old notes" },
      ]);
      yield* run(created);
      const asked = yield* settle(created.missionId, (current) => openOf(current).length > 0);
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
      yield* run(created);
      const asked = yield* settle(created.missionId, (current) => openOf(current).length > 0);
      expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Old notes".');
      expect((yield* read(quest.missionId)).mission.state).not.toBe("Archived");
    }).pipe(withService),
  );

  it.live("applies only in its runs, and asks again once the owner revokes it", () =>
    Effect.gen(function* () {
      const quest = yield* restingQuest("Old notes");
      const created = yield* withScope("Hello", [{ operation: "Archive", payload: null, target: quest.missionId }]);
      // An owner's message in the Ritual's quest is not a run: the scope does not apply.
      yield* send(created.threadId, archiveCall(quest.missionId));
      const owner = yield* settle(created.missionId, (current) => openOf(current).length > 0);
      const question = openOf(owner)[0];
      if (question === undefined) return yield* Effect.die("No question");
      yield* call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: question.id });
      yield* settle(created.missionId, isIdle);

      const ritual = yield* readRitual(created.missionId);
      if (ritual === null) return yield* Effect.die("Missing Ritual");
      yield* call({
        _tag: "UpdateRitual",
        ...ritual,
        instruction: archiveCall(quest.missionId),
        ritualId: ritual.id,
        scope: [],
      });
      expect((yield* readRitual(created.missionId))?.scope).toEqual([]);
      yield* run(created);
      const asked = yield* settle(created.missionId, (current) => openOf(current).length > 0);
      expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Old notes".');
    }).pipe(withService),
  );

  it.live("changes a setting inside its scope unasked, and asks in the next run once that entry is revoked", () =>
    Effect.gen(function* () {
      const change = `call change_setting ${JSON.stringify({ setting: "shouldShowFinishedQuests", value: "true" })}`;
      const created = yield* withScope(change, [
        { operation: "ChangeSetting", payload: "true", target: "shouldShowFinishedQuests" },
      ]);
      yield* run(created);
      const done = yield* settle(created.missionId, (current) =>
        current.questions.some((question) => question.outcome === "AllowedByPermission"),
      );
      expect(openOf(done)).toEqual([]);
      const settings = yield* call({ _tag: "ReadSettings" });
      expect(settings.shouldShowFinishedQuests).toBe(true);
      yield* settle(created.missionId, isIdle);

      // The owner puts the setting back and takes the entry out of the scope: the same instruction now asks.
      yield* call({ _tag: "UpdateSettings", settings: { ...settings, shouldShowFinishedQuests: false } });
      const ritual = yield* readRitual(created.missionId);
      if (ritual === null) return yield* Effect.die("Missing Ritual");
      yield* call({ _tag: "UpdateRitual", ...ritual, ritualId: ritual.id, scope: [] });
      yield* run(created);
      const asked = yield* settle(created.missionId, (current) => openOf(current).length > 0);
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
      yield* run(created);
      const asked = yield* settle(created.missionId, (current) => openOf(current).length > 0);
      expect(openOf(asked)[0]?.summary).toBe('Archive the quest "Old notes".');
      expect((yield* read(named.missionId)).mission.state).not.toBe("Archived");
    }).pipe(withService),
  );

  it.live("gives a Ritual's thread no other structural tool, and an ordinary quest's thread none", () =>
    Effect.gen(function* () {
      const quest = yield* restingQuest("Old notes");
      const created = yield* withScope("Hello", [{ operation: "Archive", payload: null, target: quest.missionId }]);
      expect(yield* tool(created.threadId, "create_realm", { name: "Ideas" })).toContain(
        "Only Chronicler makes realms",
      );
      expect(yield* tool(created.threadId, "rename_realm", { name: "Ideas", realm: "Borderlands" })).toContain(
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
        (yield* failureOf([{ operation: "ChangeSetting", payload: '"Never"', target: "approvalLevel" }])).kind,
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
