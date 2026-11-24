import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import type { MissionId, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { approvedCall, guildmaster, isIdle, lastAgentText, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { fixture, settle, tool } from "../fixtures/service.ts";
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

describe("managing realms at the owner's request", () => {
  const manage = (place: { missionId: MissionId; threadId: ThreadId }, name: string, args: object) =>
    approvedCall(place, name, args);
  const realms = Effect.map(listed, (list) => list.workspaces);

  it.live("makes no realm outside a turn, where nobody can be asked", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const refused = yield* tool(place.threadId, "create_realm", { name: "Ideas" });
      expect(refused).toContain("Not done");
      expect(yield* realms).toHaveLength(0);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("makes a realm tied to no folder", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* manage(place, "create_realm", { name: "Ideas" });
      expect((yield* realms).map((realm) => [realm.name, realm.path])).toEqual([["ideas", null]]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("makes a realm tied to a folder", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const place = yield* guildmaster;
      const folder = folderIn(directory, "shop");
      yield* manage(place, "create_realm", { folder, name: "Shop" });
      expect((yield* realms).map((realm) => [realm.name, realm.path])).toEqual([["shop", folder]]);
    }).pipe(Effect.provide(layer));
  });

  it.live("allows a confirmed duplicate name, but refuses a folder that already has a realm", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const place = yield* guildmaster;
      const folder = folderIn(directory, "shop");
      yield* manage(place, "create_realm", { folder, name: "Shop" });
      const sameName = yield* manage(place, "create_realm", { name: "shop" });
      expect(sameName).toContain('Made the realm "shop"');
      const sameFolder = yield* manage(place, "create_realm", { folder, name: "Store" });
      expect(sameFolder).toContain("already belongs to a realm");
      expect((yield* realms).map((realm) => realm.name).sort()).toEqual(["shop", "shop"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("refuses a folder that does not exist, and makes no realm", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const place = yield* guildmaster;
      const folder = join(directory, "nowhere");
      const refused = yield* manage(place, "create_realm", { folder, name: "Ghost" });
      expect(refused).toContain("Not done: No folder at");
      expect(yield* realms).toHaveLength(0);
    }).pipe(Effect.provide(layer));
  });

  it.live("renames a realm found by its name, whatever the case", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* manage(place, "create_realm", { name: "Ideas" });
      yield* manage(place, "rename_realm", { name: "Notions", realm: "ideas" });
      expect((yield* realms).map((realm) => realm.name)).toEqual(["notions"]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("refuses an unknown realm but allows a confirmed duplicate rename", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* manage(place, "create_realm", { name: "Ideas" });
      yield* manage(place, "create_realm", { name: "Notions" });
      const unknown = yield* manage(place, "rename_realm", { name: "X", realm: "nowhere" });
      expect(unknown).toContain('no realm "nowhere"');
      const duplicate = yield* manage(place, "rename_realm", {
        name: "NOTIONS",
        realm: "Ideas",
      });
      expect(duplicate).toContain('to "notions"');
      expect((yield* realms).map((realm) => realm.name).sort()).toEqual(["notions", "notions"]);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("asks the owner nothing about a realm action the tool would refuse, and says why", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const place = yield* guildmaster;
      const folder = folderIn(directory, "shop");
      yield* manage(place, "create_realm", { folder, name: "Shop" });
      yield* manage(place, "create_realm", { name: "Notions" });
      const refusals: ReadonlyArray<readonly [string, object, string]> = [
        ["create_realm", { folder, name: "Store" }, "already belongs to a realm"],
        ["rename_realm", { name: "Anything", realm: "nowhere" }, 'no realm "nowhere"'],
      ];
      for (const [name, args, reason] of refusals) {
        // Escaped so the owner's message never names the target: a question would be the only way to authorize it.
        yield* say(
          place.threadId,
          `What is it about?\ncall ${name} ${JSON.stringify(args).replaceAll(" ", "\\u0020")}`,
        );
        const detail = yield* settle(
          place.missionId,
          (detail) => isIdle(detail) || detail.questions.some((question) => question.outcome === null),
          place.threadId,
        );
        expect(
          detail.questions.filter((question) => question.outcome === null),
          name,
        ).toEqual([]);
        expect(lastAgentText(detail), name).toContain(reason);
      }
      expect((yield* realms).map((realm) => realm.name).sort()).toEqual(["notions", "shop"]);
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the realm tools to Chronicler: a quest's thread is refused", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Some quest");
      expect(yield* tool(quest.threadId, "create_realm", { name: "Mine" })).toContain("Only Chronicler");
      expect(yield* tool(quest.threadId, "rename_realm", { name: "Mine", realm: "Notions" })).toContain(
        "Only Chronicler",
      );
    }).pipe(Effect.provide(setup().layer)),
  );
});
