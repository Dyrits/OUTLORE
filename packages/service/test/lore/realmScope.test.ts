import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { save } from "../fixtures/lore.ts";
import { call, fixture, open, read, register, send, settle, start, tool } from "../fixtures/service.ts";

describe("recalling the quest's realm", () => {
  it.live("keeps quest lore out of another quest in the same realm", () => {
    const { directory, layer } = register(fixture());
    return Effect.gen(function* () {
      const first = yield* start("First", directory);
      yield* settle(first.missionId, (detail) => detail.thread.state === "Idle");
      yield* save(first.threadId, "A private quartz quest fact.", "mission");
      const second = yield* start("Second", directory);
      yield* settle(second.missionId, (detail) => detail.thread.state === "Idle");
      const result = yield* tool(second.threadId, "search_intel", { query: "quartz" });
      expect(result).toContain("No lore");
      const view = yield* call({
        _tag: "ListIntel",
        scope: null,
        state: null,
        threadId: second.threadId,
        workspaceId: null,
      });
      expect(view.loreEntries.map((entry) => entry.text)).not.toContain("A private quartz quest fact.");
    }).pipe(Effect.provide(layer));
  });

  it.live("ignores an errand's different workspace and does not leak its lore", () => {
    const { directory, layer } = register(fixture());
    return Effect.gen(function* () {
      const quest = yield* start("Quest", directory);
      yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
      yield* save(quest.threadId, "Realm alpha keeps moon maps.", "workspace");
      yield* call({ _tag: "CreateRealm", name: "Beta", path: null });
      const list = yield* call({
        _tag: "ListMissions",
        isArchived: false,
        search: null,
        state: null,
        workspaceId: null,
      });
      const beta = list.workspaces.find((realm) => realm.name === "Beta");
      if (beta === undefined) return yield* Effect.die("Beta realm not created");
      const other = yield* call({ _tag: "StartEmptyQuest", realmId: beta.id, requestId: crypto.randomUUID() });
      yield* send(other.threadId, "Other quest");
      yield* settle(other.missionId, (detail) => detail.thread.state === "Idle");
      yield* save(other.threadId, "Realm beta keeps star maps.", "workspace");
      const side = yield* open(quest.threadId, "Errand");
      yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle", side.threadId);
      const sql = yield* SqlClient.SqlClient;
      yield* sql`UPDATE threads SET workspace_id = ${beta.id} WHERE id = ${side.threadId}`;
      const before = (yield* read(quest.missionId, side.threadId)).messages.length;
      yield* send(side.threadId, "context");
      const detail = yield* settle(
        quest.missionId,
        (view) => view.thread.state === "Idle" && view.messages.length > before,
        side.threadId,
      );
      const context = detail.messages.findLast((message) => message.sender === "agent")?.text ?? "";
      expect(context).toContain("Realm alpha keeps moon maps.");
      expect(context).not.toContain("Realm beta keeps star maps.");
    }).pipe(Effect.provide(layer));
  });
});
