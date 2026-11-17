import { describe, expect, it } from "@effect/vitest";
import { Effect, PubSub } from "effect";
import { afterEach } from "vitest";
import { Changes } from "../../src/core/index.ts";
import { guildmaster, lastAgentText, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, read, settle, start } from "../fixtures/service.ts";
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

describe("carrying the Chronicler name", () => {
  it.live("is Chronicler: its quest and its thread carry that title", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const detail = yield* read(place.missionId);
      expect(detail.mission.title).toBe("Chronicler");
      expect(detail.threads.find((thread) => thread.id === place.threadId)?.title).toBe("Chronicler");
    }).pipe(Effect.provide(setup().layer)),
  );
});

describe("keeping the Guildmaster's place", () => {
  it.live("is made once, hidden from every list, and cannot be ended, renamed, or deleted", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      expect(yield* guildmaster).toEqual(place);
      yield* startIdle("Fix the printer");
      const dashboard = yield* listed;
      expect(dashboard.missions.map((mission) => mission.id)).not.toContain(place.missionId);
      const archived = yield* call({
        _tag: "ListMissions",
        isArchived: true,
        search: null,
        state: null,
        workspaceId: null,
      });
      expect(archived.missions.map((mission) => mission.id)).not.toContain(place.missionId);
      const searched = yield* call({
        _tag: "ListMissions",
        isArchived: false,
        search: "Guildmaster",
        state: null,
        workspaceId: null,
      });
      expect(searched.missions).toEqual([]);
      const refusals = [
        yield* Effect.flip(call({ _tag: "PreviewEnding", ending: "Archived", missionId: place.missionId })),
        yield* Effect.flip(call({ _tag: "RenameMission", missionId: place.missionId, title: "Mine" })),
        yield* Effect.flip(call({ _tag: "PreviewDeletion", threadId: place.threadId })),
      ];
      for (const refusal of refusals) expect(JSON.stringify(refusal)).toContain("Chronicler is permanent");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("announces a change only when it makes the place, so a screen reading it does not reload forever", () =>
    Effect.gen(function* () {
      const subscription = yield* PubSub.subscribe((yield* Changes).pubsub);
      yield* guildmaster;
      expect((yield* PubSub.takeUpTo(subscription, 100)).length).toBeGreaterThan(0);
      yield* guildmaster;
      yield* guildmaster;
      expect(yield* PubSub.takeUpTo(subscription, 100)).toHaveLength(0);
    }).pipe(Effect.scoped, Effect.provide(setup().layer)),
  );

  it.live("starts a turn from its own instructions, the realms, and the quests as a list, not a journal", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const folder = folderIn(directory, "app");
      const quest = yield* startIdle("Add dark mode to the settings page", folder);
      const place = yield* guildmaster;
      yield* say(place.threadId, "context");
      const detail = yield* settle(
        place.missionId,
        (detail) => lastAgentText(detail).includes("# You are Chronicler"),
        place.threadId,
      );
      const context = lastAgentText(detail);
      expect(context).toContain("propose quests");
      expect(context).toContain(`- app: ${folder}`);
      expect(context).toContain(`"Add dark mode to the settings page" (id ${quest.missionId})`);
      expect(context).not.toContain("# Quest journal at this turn");
      expect(context).not.toContain("open_thread once per part");
    }).pipe(Effect.provide(layer));
  });

  it.live("shows each quest's state, so it can tell which one needs the owner", () =>
    Effect.gen(function* () {
      const resting = yield* startIdle("Add dark mode to the settings page");
      const asking = yield* start('ask {"action":"Push the commits","command":"git push origin main"}');
      yield* settle(asking.missionId, (detail) => detail.thread.state === "Attention");
      const place = yield* guildmaster;
      yield* say(place.threadId, "context");
      const detail = yield* settle(
        place.missionId,
        (detail) => lastAgentText(detail).includes("# You are Chronicler"),
        place.threadId,
      );
      const context = lastAgentText(detail);
      expect(context).toContain(`(id ${resting.missionId}) · Idle ·`);
      expect(context).toContain(`(id ${asking.missionId}) · Attention ·`);
    }).pipe(Effect.provide(setup().layer)),
  );
});
