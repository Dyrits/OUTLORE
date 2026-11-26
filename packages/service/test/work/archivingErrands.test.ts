import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, open, read, send, settle, start } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};

describe("archiving an errand on its own", () => {
  it.live("takes it out of the tree and the quest's count, keeps it readable, and restores it", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Resting");
        const opened = yield* open(threadId, "wait 2000");
        yield* call({ _tag: "ArchiveThread", threadId: opened.threadId });
        const tree = yield* call({ _tag: "ReadThreadTree", missionId });
        expect(tree.map((thread) => thread.id)).toEqual([threadId]);
        const detail = yield* read(missionId, opened.threadId);
        expect(detail.threads.find((thread) => thread.id === opened.threadId)?.isArchived).toBe(true);
        expect(detail.mission.threadCount).toBe(1);
        expect(detail.thread.state).toBe("Stopped");
        const refusal = yield* send(opened.threadId, "more").pipe(Effect.flip);
        expect(String(refusal)).toContain("Restore it");
        yield* call({ _tag: "RestoreThread", threadId: opened.threadId });
        expect((yield* call({ _tag: "ReadThreadTree", missionId })).length).toBe(2);
      }),
    ),
  );

  it.live("deletes an errand that holds nothing instead of archiving it", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        const detail = yield* settle(missionId, (current) => current.thread.state === "Resting");
        const message = detail.messages.find((candidate) => candidate.sender === "agent");
        if (message === undefined) return yield* Effect.die("No reply");
        const opened = yield* call({
          _tag: "ReplyToMessage",
          accountId: detail.thread.accountId,
          effort: detail.thread.effort,
          harness: detail.thread.harness,
          messageId: message.id,
          model: detail.thread.model,
          requestId: "empty-errand",
        });
        expect((yield* read(missionId, opened.threadId)).threads.find((t) => t.id === opened.threadId)?.isEmpty).toBe(
          true,
        );
        yield* call({ _tag: "ArchiveThread", threadId: opened.threadId });
        expect((yield* call({ _tag: "ReadThreadTree", missionId })).map((thread) => thread.id)).toEqual([threadId]);
        expect((yield* read(missionId)).threads.map((thread) => thread.id)).toEqual([threadId]);
      }),
    ),
  );

  it.live("refuses the quest's own thread", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        const refusal = yield* call({ _tag: "ArchiveThread", threadId }).pipe(Effect.flip);
        expect(String(refusal)).toContain("archive the quest");
      }),
    ),
  );
});

describe("a quest waiting for the owner", () => {
  it.live("is Resting after a completed turn, and Fresh before anything is sent", () =>
    withService(
      Effect.gen(function* () {
        const empty = yield* call({ _tag: "StartEmptyQuest", realmId: null, requestId: "empty" });
        expect((yield* read(empty.missionId)).mission.state).toBe("Fresh");
        const { missionId } = yield* start("Hello");
        const detail = yield* settle(missionId, (current) => current.thread.state === "Resting");
        expect(detail.mission.state).toBe("Resting");
        expect(detail.threads[0]?.shownState).toBe("Resting");
      }),
    ),
  );
});
