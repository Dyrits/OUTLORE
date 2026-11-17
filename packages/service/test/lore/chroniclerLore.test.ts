import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { guildmaster } from "../fixtures/guildmaster.ts";
import { approveAll, idOf, loreEntryOf, save } from "../fixtures/lore.ts";
import { fixture, open, register, settle, start, tool } from "../fixtures/service.ts";

describe("searching lore as Chronicler", () => {
  it.live("reads every scope without granting other threads or changes the same reach", () => {
    const { directory, layer } = register(fixture());
    return Effect.gen(function* () {
      const chronicler = yield* guildmaster;
      const quest = yield* start("Quest", directory);
      yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
      const realmId = idOf(yield* save(quest.threadId, "Orchid realm detail.", "workspace"));
      const questId = idOf(yield* save(quest.threadId, "Orchid quest detail.", "mission"));
      yield* save(quest.threadId, "Orchid global detail.", "global");
      yield* approveAll();
      const side = yield* open(quest.threadId, "Side-quest");
      yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle", side.threadId);
      const sideId = idOf(yield* save(side.threadId, "Orchid side-quest detail.", "thread"));
      const other = yield* start("Other quest", null);
      yield* settle(other.missionId, (detail) => detail.thread.state === "Idle");
      const found = yield* tool(chronicler.threadId, "search_intel", { query: "orchid" });
      expect(found).toContain("Orchid realm detail.");
      expect(found).toContain("Orchid quest detail.");
      expect(found).toContain("Orchid side-quest detail.");
      expect(found).toContain("Orchid global detail.");
      expect(found.indexOf("Orchid side-quest detail.")).toBeLessThan(found.indexOf("Orchid quest detail."));
      expect(found.indexOf("Orchid quest detail.")).toBeLessThan(found.indexOf("Orchid realm detail."));
      expect(found.indexOf("Orchid realm detail.")).toBeLessThan(found.indexOf("Orchid global detail."));
      const questOnly = yield* tool(chronicler.threadId, "search_intel", { query: "orchid", scope: "mission" });
      expect(questOnly).toContain("Orchid quest detail.");
      expect(questOnly).not.toContain("Orchid side-quest detail.");
      expect(yield* tool(chronicler.threadId, "search_intel", { ids: [realmId, questId, sideId] })).toContain(
        "Orchid side-quest detail.",
      );
      expect(yield* tool(other.threadId, "search_intel", { ids: [realmId, questId, sideId] })).toContain("No lore");
      const helper = yield* open(chronicler.threadId, "Chronicler helper");
      yield* settle(chronicler.missionId, (detail) => detail.thread.state === "Idle", helper.threadId);
      expect(yield* tool(helper.threadId, "search_intel", { ids: [questId] })).toContain("No lore");
      expect(yield* tool(chronicler.threadId, "update_intel", { id: questId, text: "Changed." })).toContain(
        "Not changed",
      );
      expect(yield* tool(chronicler.threadId, "forget_intel", { id: sideId })).toContain("Not deleted");
    }).pipe(Effect.provide(layer));
  });

  it.live("counts no use and wakes no dormant lore when it reads another scope", () => {
    const { directory, layer } = register(fixture());
    return Effect.gen(function* () {
      const chronicler = yield* guildmaster;
      const quest = yield* start("Quest", directory);
      yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
      const questId = idOf(yield* save(quest.threadId, "Orchid quest detail.", "mission"));
      const before = yield* loreEntryOf(questId);
      expect(yield* tool(chronicler.threadId, "search_intel", { query: "orchid" })).toContain("Orchid quest detail.");
      expect(yield* tool(chronicler.threadId, "search_intel", { ids: [questId] })).toContain("Orchid quest detail.");
      const after = yield* loreEntryOf(questId);
      expect(after?.uses).toBe(0);
      expect(after).toMatchObject({ lastUsedAt: before?.lastUsedAt, state: before?.state });
    }).pipe(Effect.provide(layer));
  });
});
