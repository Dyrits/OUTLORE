import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { isIdle, say } from "../fixtures/guildmaster.ts";
import { call, fixture, read, settle } from "../fixtures/service.ts";

it.live("copies the first message sent inside an empty quest to its channel as the quest's anchor, once", () => {
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
    yield* call({ _tag: "SetThreadPermissionMode", mode: "Auto", threadId: channel.threadId });
    const quest = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() });
    yield* call({ _tag: "SetThreadPermissionMode", mode: null, threadId: channel.threadId });
    const next = yield* call({ _tag: "StartEmptyQuest", realmId: realm.id, requestId: crypto.randomUUID() });
    expect((yield* read(quest.missionId)).thread.permissionMode).toBe("Auto");
    expect((yield* read(next.missionId)).thread.permissionMode).toBeNull();
    const text = "Catalogue the folio";
    yield* say(quest.threadId, text);
    const detail = yield* settle(quest.missionId, isIdle);
    expect(detail.messages.filter((message) => message.sender === "user").map((message) => message.text)).toEqual([
      text,
    ]);
    // The copy waits for no answer: it is conversation only, and the next message stays in the quest.
    yield* say(quest.threadId, "And the margins");
    const copies = (yield* read(channel.missionId, channel.threadId)).messages;
    expect(copies.map((message) => [message.sender, message.text])).toEqual([["user", text]]);
    expect(yield* call({ _tag: "ReadThreadAnchors", threadId: channel.threadId })).toEqual([
      expect.objectContaining({ messageId: copies[0]?.id, missionId: quest.missionId, threadId: quest.threadId }),
    ]);
  }).pipe(Effect.provide(store.layer), Effect.ensuring(Effect.sync(store.remove)));
});
