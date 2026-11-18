import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { threadTools, toolListing } from "../../src/work/threadTools.ts";
import { guildmaster, isIdle, lastAgentText, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, read, settle, tool } from "../fixtures/service.ts";
import { answer, folderIn, proposeCard, questOf } from "./guildmasterHelpers.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("proposing a quest", () => {
  it.live(
    "proposes it as a card with no match, opens nothing until the owner chooses, then opens it in the realm",
    () => {
      const { directory, layer } = setup();
      return Effect.gen(function* () {
        const folder = folderIn(directory, "app");
        yield* startIdle("Existing work", folder);
        const place = yield* guildmaster;
        const args = { realm: "app", text: "Fix the login redirect loop", title: "Login loop" };
        yield* say(place.threadId, `call suggest_mission ${JSON.stringify(args)}`);
        const waiting = yield* settle(
          place.missionId,
          (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === null),
          place.threadId,
        );
        const card = waiting.suggestions.find((suggestion) => suggestion.outcome === null);
        if (card === undefined) return yield* Effect.die("Missing card");
        expect(card).toMatchObject({ isFromGuildmaster: true, matches: [] });
        expect((yield* listed).missions).toHaveLength(1);
        yield* answer(card, { _tag: "NewMission", effort: "default", model: "default" });
        const detail = yield* settle(
          place.missionId,
          (detail) =>
            detail.suggestions.some((suggestion) => suggestion.outcome === "MovedToMission") && isIdle(detail),
          place.threadId,
        );
        expect(detail.suggestions[0]).toMatchObject({
          isAutomatic: false,
          outcome: "MovedToMission",
          targetTitle: "Login loop",
        });
        const opened = yield* settle(yield* questOf(detail.suggestions[0]), (detail) =>
          detail.messages.some((message) => message.sender === "agent"),
        );
        expect(opened.messages[0]?.text).toBe("Fix the login redirect loop");
        expect(opened.thread.workspace?.path).toBe(folder);
        expect((yield* listed).missions.map((mission) => mission.title)).toContain("Login loop");
      }).pipe(Effect.provide(layer));
    },
  );

  const twoRealms = () => {
    const { directory, layer } = setup();
    return {
      directory,
      layer,
      prepare: Effect.gen(function* () {
        const shop = folderIn(directory, "shop");
        const app = folderIn(directory, "app");
        yield* startIdle("Existing", shop);
        yield* startIdle("Other", app);
        return { app, place: yield* guildmaster, shop };
      }),
    };
  };

  it.live("proposes the realm Chronicler names, and opens the quest in the one the owner picks instead", () => {
    const { layer, prepare } = twoRealms();
    return Effect.gen(function* () {
      const { app, place, shop } = yield* prepare;
      const card = yield* proposeCard(place, { realm: "shop", text: "First", title: "First" });
      expect(card.realmPath).toBe(shop);
      yield* answer(card, { _tag: "NewMission", effort: "default", model: "default", realmPath: app });
      const done = yield* settle(
        place.missionId,
        (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === "MovedToMission") && isIdle(detail),
        place.threadId,
      );
      const opened = yield* read(yield* questOf(done.suggestions[0]));
      expect(opened.thread.workspace?.path).toBe(app);
    }).pipe(Effect.provide(layer));
  });

  it.live("opens the quest in the Borderlands when the owner picks no realm", () => {
    const { layer, prepare } = twoRealms();
    return Effect.gen(function* () {
      const { place } = yield* prepare;
      const card = yield* proposeCard(place, { realm: "shop", text: "Second", title: "Second" });
      yield* answer(card, { _tag: "NewMission", effort: "default", model: "default", realmPath: null });
      const done = yield* settle(
        place.missionId,
        (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === "MovedToMission") && isIdle(detail),
        place.threadId,
      );
      expect((yield* read(yield* questOf(done.suggestions[0]))).thread.workspace).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a folder no realm is tied to, and leaves the card waiting", () => {
    const { directory, layer, prepare } = twoRealms();
    return Effect.gen(function* () {
      const { place } = yield* prepare;
      const card = yield* proposeCard(place, { realm: "shop", text: "Third", title: "Third" });
      const refused = yield* Effect.flip(
        answer(card, {
          _tag: "NewMission",
          effort: "default",
          model: "default",
          realmPath: join(directory, "nowhere"),
        }),
      );
      expect(JSON.stringify(refused)).toContain("No realm is tied to that folder");
      const waiting = yield* read(place.missionId, place.threadId);
      expect(waiting.suggestions.some((suggestion) => suggestion.outcome === null)).toBe(true);
    }).pipe(Effect.provide(layer));
  });

  it.live("makes no card for a realm that does not exist or has no folder, and tells Chronicler which to name", () =>
    Effect.gen(function* () {
      yield* call({ _tag: "CreateRealm", name: "Ideas", path: null });
      yield* startIdle("Existing");
      const place = yield* guildmaster;
      for (const realm of ["nowhere", "Ideas"]) {
        yield* say(place.threadId, `call suggest_mission ${JSON.stringify({ realm, text: "Job", title: "Job" })}`);
        const detail = yield* settle(
          place.missionId,
          (detail) => isIdle(detail) && lastAgentText(detail).includes(`Not proposed: no realm "${realm}"`),
          place.threadId,
        );
        expect(detail.suggestions).toEqual([]);
      }
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("has no tool to open a quest by itself, only the card", () =>
    Effect.gen(function* () {
      expect(Object.keys(threadTools)).not.toContain("open_mission");
      expect(toolListing.map((listed) => listed.name)).not.toContain("open_mission");
      const place = yield* guildmaster;
      yield* tool(place.threadId, "open_mission", { request: "Do something" });
      expect((yield* listed).missions).toHaveLength(0);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("opens no thread beneath itself", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const refused = yield* tool(place.threadId, "open_thread", { request: "Split this up" });
      expect(refused).toContain("opens no threads");
      expect((yield* read(place.missionId)).threads).toHaveLength(1);
    }).pipe(Effect.provide(setup().layer)),
  );
});
