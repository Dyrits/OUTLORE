import { describe, expect, it } from "@effect/vitest";
import type { MissionId, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { approvedCall, guildmaster, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("settings at the owner's request", () => {
  const manage = (place: { missionId: MissionId; threadId: ThreadId }, name: string, args: object) =>
    approvedCall(place, name, args);
  const settings = call({ _tag: "ReadSettings" });

  it.live("reads the settings, and names those it may not change", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const text = yield* tool(place.threadId, "read_settings", {});
      expect(text).toContain('"shouldShowFinishedQuests":false');
      expect(text).toContain("You may not change: approvalLevel");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("changes a setting only once allowed, and says from what to what", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const args = { setting: "shouldShowFinishedQuests", value: "true" };
      const refused = yield* tool(place.threadId, "change_setting", args);
      expect(refused).toContain("Not done");
      expect((yield* settings).shouldShowFinishedQuests).toBe(false);
      const done = yield* manage(place, "change_setting", args);
      expect(done).toContain("Changed shouldShowFinishedQuests from false to true");
      expect((yield* settings).shouldShowFinishedQuests).toBe(true);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("changes a whole setting of a nested shape, leaving the others as they were", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const before = yield* settings;
      yield* manage(place, "change_setting", {
        setting: "intelHalfLives",
        value: JSON.stringify({ ...before.intelHalfLives, temporary: 7 }),
      });
      const after = yield* settings;
      expect(after.intelHalfLives.temporary).toBe(7);
      expect({ ...after, intelHalfLives: before.intelHalfLives }).toEqual(before);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps the approval level, working outside the sandbox, the budgets, and price fetching to the owner", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const before = yield* settings;
      for (const [setting, value] of [
        ["approvalLevel", '"Never"'],
        ["globalBudget", '{"cost":1,"tokens":null}'],
        ["defaultMissionBudget", '{"cost":1,"tokens":null}'],
        ["globalBudgetPeriod", '"Day"'],
        ["shouldFetchPrices", "false"],
        ["shouldAllowOutsideSandbox", "true"],
      ] as const) {
        const refused = yield* manage(place, "change_setting", { setting, value });
        expect(refused).toContain("the owner's alone");
      }
      expect(yield* settings).toEqual(before);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("refuses an unknown setting and a value the setting does not accept, and changes nothing", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const before = yield* settings;
      const unknown = yield* manage(place, "change_setting", {
        setting: "theme",
        value: '"x"',
      });
      expect(unknown).toContain('no setting "theme"');
      const wrong = yield* manage(place, "change_setting", {
        setting: "chatterThreshold",
        value: "1",
      });
      expect(wrong).toContain("not a value chatterThreshold accepts");
      const wrongShape = yield* manage(place, "change_setting", {
        setting: "shouldStreamReplies",
        value: '"yes"',
      });
      expect(wrongShape).toContain("not a value shouldStreamReplies accepts");
      expect(yield* settings).toEqual(before);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps the settings tools to Chronicler: a quest's thread is refused", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Some quest");
      expect(yield* tool(quest.threadId, "read_settings", {})).toContain("Only Chronicler");
      expect(
        yield* tool(quest.threadId, "change_setting", {
          setting: "shouldShowFinishedQuests",
          value: "true",
        }),
      ).toContain("Only Chronicler");
      expect((yield* settings).shouldShowFinishedQuests).toBe(false);
    }).pipe(Effect.provide(setup().layer)),
  );
});
