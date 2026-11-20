import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { isIdle, say } from "../fixtures/guildmaster.ts";
import { call, fixture, read, settle } from "../fixtures/service.ts";

it.live("keeps the first message sent inside an empty quest in that quest", () => {
  const store = fixture();
  return Effect.gen(function* () {
    yield* call({ _tag: "CreateRealm", name: "Ideas", path: null });
    const {
      workspaces: [realm],
    } = yield* call({
      _tag: "ListMissions",
      isArchived: false,
      search: null,
      state: null,
      workspaceId: null,
    });
    if (realm === undefined) return yield* Effect.die("Missing realm");
    const channel = yield* call({ _tag: "ReadGuildmaster", channelId: realm.id });
    const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() });
    const text = "Catalogue the folio";
    yield* say(quest.threadId, text);
    const detail = yield* settle(quest.missionId, isIdle);
    expect(detail.messages.filter((message) => message.sender === "user").map((message) => message.text)).toEqual([
      text,
    ]);
    expect((yield* read(channel.missionId)).messages).toEqual([]);
    expect(yield* call({ _tag: "ReadThreadAnchors", threadId: channel.threadId })).toEqual([]);
  }).pipe(Effect.provide(store.layer), Effect.ensuring(Effect.sync(store.remove)));
});
