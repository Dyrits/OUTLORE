import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { isIdle, lastAgentText } from "../fixtures/guildmaster.ts";
import { call, fixture, read, settle, start } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** The sample a reply line quotes: the owner's latest message and the companion's latest reply, cut to 160 characters. */
describe("reply line samples", () => {
  it.live("quotes the owner's first message and the companion's reply of a quest, and matches its thread summary", () =>
    Effect.gen(function* () {
      const started = yield* start("Plan the release notes");
      const detail = yield* settle(started.missionId, isIdle);
      expect(detail.mission.lastExchange.owner).toBe("Plan the release notes");
      expect(detail.mission.lastExchange.reply).toBe(lastAgentText(detail));
      expect(detail.threads[0]?.lastExchange).toEqual(detail.mission.lastExchange);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("cuts a long message to a sample of 160 characters", () =>
    Effect.gen(function* () {
      const started = yield* start("a".repeat(300));
      const detail = yield* settle(started.missionId, isIdle);
      expect(detail.mission.lastExchange.owner).toBe("a".repeat(160));
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("quotes an errand's own last reply, and the quest list carries the same sample", () =>
    Effect.gen(function* () {
      const started = yield* start(
        `call open_thread ${JSON.stringify({ request: "Brief the design", title: "Design" })}`,
      );
      yield* settle(started.missionId, (detail) => detail.threads.length === 2 && isIdle(detail));
      const detail = yield* read(started.missionId);
      const errand = detail.threads.find((thread) => thread.parentId !== null);
      if (errand === undefined) return yield* Effect.die("Missing errand");
      const errandDetail = yield* read(started.missionId, errand.id);
      const reply = lastAgentText(errandDetail);
      expect(errand.lastExchange.reply).toBe(reply === "" ? null : reply);
      const list = yield* call({
        _tag: "ListMissions",
        isArchived: false,
        search: null,
        state: null,
        workspaceId: null,
      });
      expect(list.missions.find((mission) => mission.id === started.missionId)?.lastExchange).toEqual(
        detail.mission.lastExchange,
      );
    }).pipe(Effect.provide(setup().layer)),
  );
});
