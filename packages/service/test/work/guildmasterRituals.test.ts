import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { approvedCall, guildmaster, isIdle, lastAgentText, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, open, settle, tool } from "../fixtures/service.ts";
import { folderIn } from "./guildmasterHelpers.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("creating a Ritual", () => {
  it.live("makes a Ritual in its own quest, with a card, in no quest list, and runs nothing yet", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const folder = folderIn(directory, "app");
      yield* startIdle("Existing work", folder);
      const place = yield* guildmaster;
      const args = {
        instruction: "Say hello to me",
        realm: "app",
        schedule: { _tag: "Hourly", hours: 1 },
        title: "Hourly hello",
      };
      yield* approvedCall(place, "create_ritual", args);
      const detail = yield* settle(
        place.missionId,
        (detail) => detail.suggestions.length === 1 && isIdle(detail),
        place.threadId,
      );
      expect(detail.suggestions[0]).toMatchObject({
        isFromGuildmaster: true,
        isRitual: true,
        targetTitle: "Hourly hello",
      });
      expect(lastAgentText(detail)).toContain('Created the Ritual "Hourly hello"');
      const rituals = yield* call({ _tag: "ListRituals" });
      expect(rituals).toHaveLength(1);
      expect(rituals[0]).toMatchObject({
        instruction: "Say hello to me",
        isOn: true,
        lastRunAt: null,
        schedule: { _tag: "Hourly", hours: 1 },
        title: "Hourly hello",
      });
      expect((yield* listed).missions.map((mission) => mission.title)).not.toContain("Hourly hello");
      const context = yield* tool(place.threadId, "read_control_history", { query: "hourly" });
      expect(context).toContain("create_ritual");
    }).pipe(Effect.provide(layer));
  });

  it.live("creates an approved Ritual from a quest and refuses an unknown realm", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Some quest");
      const args = { instruction: "Ping", schedule: { _tag: "Daily", time: "07:00" }, title: "Ping" };
      expect(yield* approvedCall(quest, "create_ritual", args)).toContain('Created the Ritual "Ping"');
      const { threadId } = yield* open(quest.threadId);
      yield* settle(quest.missionId, isIdle, threadId);
      expect(
        yield* approvedCall({ missionId: quest.missionId, threadId }, "create_ritual", { ...args, title: "Pong" }),
      ).toContain('Created the Ritual "Pong"');
      const place = yield* guildmaster;
      expect(yield* tool(place.threadId, "create_ritual", { ...args, realm: "nowhere" })).toContain(
        'no realm "nowhere"',
      );
      expect(yield* call({ _tag: "ListRituals" })).toMatchObject([
        { originMissionId: quest.missionId, title: "Pong" },
        { originMissionId: quest.missionId, title: "Ping" },
      ]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("creates in a folderless realm from its conversation", () =>
    Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "Ideas", path: null });
      const realm = (yield* listed).workspaces.find(({ name }) => name === "Ideas");
      if (realm === undefined) throw new Error("Missing realm fixture.");
      const place = yield* call({ _tag: "ReadGuildmaster", channelId: realm.id });
      const args = { instruction: "Ping", schedule: { _tag: "Daily", time: "07:00" }, title: "Ping" };
      expect(yield* approvedCall(place, "create_ritual", args)).toContain('Created the Ritual "Ping"');
      const quests = yield* call({
        _tag: "ListMissions",
        includeRituals: true,
        isArchived: false,
        search: null,
        state: null,
        workspaceId: realm.id,
      });
      expect(quests.missions).toMatchObject([{ ritual: { originMissionId: null }, title: "Ping" }]);
      const other = yield* startIdle("Outside the realm");
      const refused = yield* tool(other.threadId, "edit_ritual", { instruction: "Pong", ritual: "Ping" });
      expect(refused).toBe("No such Ritual in this realm.");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("edits a Ritual from an errand after approval", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Related work");
      yield* approvedCall(quest, "create_ritual", {
        instruction: "Ping",
        schedule: { _tag: "Daily", time: "07:00" },
        title: "Ping",
      });
      const { threadId } = yield* open(quest.threadId);
      yield* settle(quest.missionId, isIdle, threadId);
      const args = { instruction: "Pong", ritual: "Ping" };
      expect(yield* approvedCall({ missionId: quest.missionId, threadId }, "edit_ritual", args)).toContain(
        'Edited the Ritual "Ping"',
      );
      expect(yield* call({ _tag: "ListRituals" })).toMatchObject([
        {
          instruction: "Pong",
          originMissionId: quest.missionId,
          schedule: { _tag: "Daily", time: "07:00" },
          title: "Ping",
        },
      ]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps the current instruction when an edit is denied or approved after a concurrent edit", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Related work");
      yield* approvedCall(quest, "create_ritual", {
        instruction: "Original",
        schedule: { _tag: "Daily", time: "07:00" },
        title: "Ping",
      });
      const [ritual] = yield* call({ _tag: "ListRituals" });
      if (ritual === undefined) throw new Error("Missing Ritual fixture.");
      const askToEdit = Effect.gen(function* () {
        yield* say(quest.threadId, 'call edit_ritual {"ritual":"Ping","instruction":"Agent edit"}');
        const detail = yield* settle(quest.missionId, (detail) =>
          detail.questions.some(({ outcome }) => outcome === null),
        );
        const question = detail.questions.find(({ outcome }) => outcome === null);
        if (question === undefined) throw new Error("Missing approval question.");
        expect(question.details).toContain("Agent edit");
        return question.id;
      });
      const denied = yield* askToEdit;
      yield* call({ _tag: "AnswerQuestion", answer: "Deny", message: null, questionId: denied });
      yield* settle(quest.missionId, isIdle);
      expect(yield* call({ _tag: "ListRituals" })).toMatchObject([{ instruction: "Original" }]);

      const pending = yield* askToEdit;
      yield* call({
        _tag: "UpdateRitual",
        fallbacks: ritual.fallbacks,
        instruction: "Owner edit",
        isOn: ritual.isOn,
        primary: ritual.primary,
        ritualId: ritual.id,
        schedule: ritual.schedule,
        title: ritual.title,
      });
      yield* call({ _tag: "AnswerQuestion", answer: "Allow", message: null, questionId: pending });
      expect(lastAgentText(yield* settle(quest.missionId, isIdle))).toContain("changed meanwhile");
      expect(yield* call({ _tag: "ListRituals" })).toMatchObject([{ instruction: "Owner edit" }]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("starts its turn knowing the Rituals that exist", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const args = { instruction: "Say hello", schedule: { _tag: "Daily", time: "07:00" }, title: "Morning hello" };
      yield* approvedCall(place, "create_ritual", args);
      yield* say(place.threadId, "context");
      const detail = yield* settle(
        place.missionId,
        (detail) => lastAgentText(detail).includes("# Rituals"),
        place.threadId,
      );
      expect(lastAgentText(detail)).toContain('"Morning hello" · on');
    }).pipe(Effect.provide(setup().layer)),
  );
});
