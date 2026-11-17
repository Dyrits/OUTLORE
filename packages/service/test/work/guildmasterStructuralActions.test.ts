import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { guildmaster, isIdle, lastAgentText, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, read, settle } from "../fixtures/service.ts";
import { archiveQuest, openQuestions } from "./guildmasterHelpers.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("taking structural actions the owner's message names", () => {
  it.live("runs at once, with no question, when the owner's message names the action and its target", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const quest = yield* startIdle("Weekly report draft");
      yield* say(place.threadId, `Please archive Weekly report draft.\n${archiveQuest(quest.missionId)}`);
      const detail = yield* settle(place.missionId, isIdle, place.threadId);
      expect(openQuestions(detail)).toEqual([]);
      expect(detail.questions.at(-1)).toMatchObject({
        outcome: "AllowedByMessage",
        summary: 'Archive the quest "Weekly report draft".',
      });
      expect((yield* read(quest.missionId)).mission.state).toBe("Archived");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("deletes a quest that used no tokens and holds no message when it archives it", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const empty = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "empty" });
      yield* say(place.threadId, `Please archive New quest.\n${archiveQuest(empty.missionId)}`);
      const detail = yield* settle(place.missionId, isIdle, place.threadId);
      expect(lastAgentText(detail)).toContain('Deleted "New quest"');
      expect((yield* Effect.flip(read(empty.missionId))).kind).toBe("NotFound");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("runs a realm change and a setting change the owner named exactly, with no question", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* call({ _tag: "CreateRealm", crest: null, name: "Ideas", path: null });
      yield* say(
        place.threadId,
        `Rename the realm Ideas to Notions.\ncall rename_realm ${JSON.stringify({ name: "Notions", realm: "Ideas" })}`,
      );
      expect(openQuestions(yield* settle(place.missionId, isIdle, place.threadId))).toEqual([]);
      expect((yield* listed).workspaces.map((realm) => realm.name)).toEqual(["Notions"]);
      yield* say(
        place.threadId,
        `Set shouldShowFinishedQuests to true.\ncall change_setting ${JSON.stringify({ setting: "shouldShowFinishedQuests", value: "true" })}`,
      );
      expect(openQuestions(yield* settle(place.missionId, isIdle, place.threadId))).toEqual([]);
      expect((yield* call({ _tag: "ReadSettings" })).shouldShowFinishedQuests).toBe(true);
    }).pipe(Effect.provide(setup().layer)),
  );
});
