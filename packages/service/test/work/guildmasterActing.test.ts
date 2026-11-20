import { describe, expect, it } from "@effect/vitest";
import type { ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { approvedCall, guildmaster, isIdle, lastAgentText, startIdle } from "../fixtures/guildmaster.ts";
import { fixture, read, send, settle, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("acting on quests at the owner's request", () => {
  const act = (threadId: ThreadId, args: object) =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      expect(place.threadId).toBe(threadId);
      return yield* approvedCall(place, "act_on_mission", args);
    });

  it.live("renames and ends a resting quest once allowed, and nothing outside a turn", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const quest = yield* startIdle("Old name");
      const refused = yield* tool(place.threadId, "act_on_mission", {
        action: "Rename",
        mission: quest.missionId,
        title: "New name",
      });
      expect(refused).toContain("Not done");
      expect((yield* read(quest.missionId)).mission.title).toBe("Old name");
      yield* act(place.threadId, {
        action: "Rename",
        mission: quest.missionId,
        title: "New name",
      });
      yield* settle(quest.missionId, (detail) => detail.mission.title === "New name");
      yield* settle(place.missionId, isIdle, place.threadId);
      yield* act(place.threadId, { action: "Done", mission: quest.missionId });
      const ended = yield* settle(quest.missionId, (detail) => detail.mission.state === "Fulfilled");
      expect(ended.mission.title).toBe("New name");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("is the Guildmaster's alone", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("A quest");
      // Even the owner's own words in that quest do not make its thread a structural caller.
      yield* send(
        quest.threadId,
        `Mark A quest done.\ncall act_on_mission ${JSON.stringify({ action: "Done", mission: quest.missionId })}`,
      );
      const detail = yield* settle(
        quest.missionId,
        (detail) => isIdle(detail) && lastAgentText(detail).includes("Only Chronicler"),
      );
      expect(lastAgentText(detail)).toContain("Only Chronicler acts on quests.");
      expect(detail.questions).toEqual([]);
      expect(detail.mission.state).not.toBe("Fulfilled");
    }).pipe(Effect.provide(setup().layer)),
  );
});
