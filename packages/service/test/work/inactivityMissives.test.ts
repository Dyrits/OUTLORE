import { expect, it } from "@effect/vitest";
import type { ThreadId, ThreadState, WorkspaceId } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import { storeLayer } from "../../src/core/index.ts";
import { call, fixture, open, read } from "../fixtures/service.ts";

const hour = 60 * 60 * 1000;

const createRealm = Effect.fnUntraced(function* (name: string) {
  yield* call({ _tag: "CreateRealm", name, path: null });
  const { workspaces } = yield* call({
    _tag: "ListMissions",
    isArchived: false,
    search: null,
    state: null,
    workspaceId: null,
  });
  const realm = workspaces.find((candidate) => candidate.name === name);
  if (realm === undefined) return yield* Effect.die(`Missing realm ${name}`);
  return realm.id;
});

const startQuest = Effect.fnUntraced(function* (realmId: WorkspaceId) {
  return yield* call({ _tag: "StartEmptyQuest", realmId, requestId: crypto.randomUUID() });
});

const insertLastMessage = Effect.fnUntraced(function* (
  threadId: ThreadId,
  state: ThreadState,
  sender: "agent" | "user",
  at: number,
) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE threads SET state = ${state} WHERE id = ${threadId}`;
  yield* sql`INSERT INTO messages (id, mission_id, thread_id, sender_kind, text, sequence, sent_at)
      SELECT ${crypto.randomUUID()}, mission_id, id, ${sender}, 'A message',
        (SELECT COALESCE(MAX(sequence), 0) + 1 FROM messages WHERE thread_id = ${threadId}), ${at}
      FROM threads WHERE id = ${threadId}`;
});

const seedLastMessage = (filename: string, ...args: Parameters<typeof insertLastMessage>) =>
  insertLastMessage(...args).pipe(Effect.provide(storeLayer(filename)));

it.effect("groups quiet errands in one linked Missive after four hours and waits for new messages", () => {
  const store = fixture();
  const filename = `${store.directory}/store.sqlite`;
  return Effect.gen(function* () {
    const realmId = yield* createRealm("Ideas");
    const otherRealm = yield* createRealm("Elsewhere");
    const quest = yield* startQuest(realmId);
    const errand = yield* open(quest.threadId, "wait 999999999");
    const sibling = yield* open(quest.threadId, "wait 999999999");
    yield* TestClock.adjust(20);
    yield* seedLastMessage(filename, errand.threadId, "Attention", "agent", 0);
    yield* seedLastMessage(filename, sibling.threadId, "Attention", "agent", 0);
    const channel = yield* call({ _tag: "ReadGuildmaster", channelId: realmId });
    const elsewhere = yield* call({ _tag: "ReadGuildmaster", channelId: otherRealm });
    const warnings = read(channel.missionId).pipe(
      Effect.map((detail) => detail.messages.filter((message) => message.sender === "system")),
    );
    yield* TestClock.adjust(4 * hour - 21);
    expect(yield* warnings).toEqual([]);
    yield* TestClock.adjust(1);
    expect(yield* warnings).toMatchObject([
      { fromMissionId: quest.missionId, text: expect.stringContaining("2 errands are in Attention") },
    ]);
    expect((yield* read(elsewhere.missionId)).messages).toEqual([]);
    yield* TestClock.adjust(2 * hour);
    expect(yield* warnings).toHaveLength(1);
    yield* seedLastMessage(filename, errand.threadId, "Attention", "user", 6 * hour);
    yield* TestClock.adjust(3 * hour);
    expect(yield* warnings).toHaveLength(1);
    yield* TestClock.adjust(hour);
    expect(yield* warnings).toMatchObject([
      { text: expect.stringContaining("2 errands are in Attention") },
      { text: expect.stringContaining("One errand is in Attention") },
    ]);
  }).pipe(Effect.provide(store.layer), Effect.ensuring(Effect.sync(store.remove)));
});

it.effect("warns about a Resting quest after twelve hours and skips threads at work", () => {
  const store = fixture();
  const filename = `${store.directory}/store.sqlite`;
  return Effect.gen(function* () {
    const realmId = yield* createRealm("Ideas");
    const resting = yield* startQuest(realmId);
    const reported = yield* startQuest(realmId);
    const underway = yield* startQuest(realmId);
    const waiting = yield* startQuest(realmId);
    yield* startQuest(realmId);
    yield* call({ _tag: "RenameMission", missionId: resting.missionId, title: "Restore catalogue" });
    yield* call({ _tag: "RenameMission", missionId: reported.missionId, title: "Review inventory" });
    yield* seedLastMessage(filename, resting.threadId, "Resting", "user", 0);
    yield* seedLastMessage(filename, reported.threadId, "Fulfilled", "agent", 0);
    yield* seedLastMessage(filename, underway.threadId, "Underway", "user", 0);
    yield* seedLastMessage(filename, waiting.threadId, "Waiting", "user", 0);
    const channel = yield* call({ _tag: "ReadGuildmaster", channelId: realmId });
    yield* TestClock.adjust(12 * hour - 1);
    expect((yield* read(channel.missionId)).messages).toEqual([]);
    yield* TestClock.adjust(1);
    const { messages } = yield* read(channel.missionId);
    expect(messages).toHaveLength(2);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromMissionId: resting.missionId,
          sender: "system",
          text: expect.stringContaining("Restore catalogue"),
        }),
        expect.objectContaining({
          fromMissionId: reported.missionId,
          sender: "system",
          text: expect.stringContaining("Review inventory"),
        }),
      ]),
    );
    expect((yield* read(resting.missionId)).mission.state).toBe("Resting");
    expect((yield* read(reported.missionId)).mission.state).toBe("Resting");
  }).pipe(Effect.provide(store.layer), Effect.ensuring(Effect.sync(store.remove)));
});
