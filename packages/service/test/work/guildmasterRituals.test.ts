import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { approvedCall, guildmaster, isIdle, lastAgentText, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, settle, tool } from "../fixtures/service.ts";
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

  it.live("is the Guildmaster's alone, and refuses a realm that does not exist", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Some quest");
      const args = { instruction: "Ping", schedule: { _tag: "Daily", time: "07:00" }, title: "Ping" };
      expect(yield* tool(quest.threadId, "create_ritual", args)).toBe("Only Chronicler creates Rituals.");
      const place = yield* guildmaster;
      expect(yield* tool(place.threadId, "create_ritual", { ...args, realm: "nowhere" })).toContain(
        'no realm "nowhere"',
      );
      expect(yield* call({ _tag: "ListRituals" })).toEqual([]);
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
