import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { save } from "../fixtures/lore.ts";
import { call, fixture, open, read, register, send, settle, start } from "../fixtures/service.ts";

describe("recalling the quest's realm", () => {
  it.live("ignores a side-quest's different workspace and does not leak its lore", () => {
    const { directory, layer } = register(fixture());
    return Effect.gen(function* () {
      const quest = yield* start("Quest", directory);
      yield* settle(quest.missionId, (detail) => detail.thread.state === "Idle");
      yield* save(quest.threadId, "Realm alpha keeps moon maps.", "workspace");
      yield* call({ _tag: "CreateRealm", crest: null, name: "Beta", path: null });
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
      const side = yield* open(quest.threadId, "Side-quest");
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
