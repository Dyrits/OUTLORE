import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, open, settle, start, withService } from "../fixtures/service.ts";

const chronicle = () => call({ _tag: "ReadChronicle" });

describe("the Chronicle's attention feed and reads (CHG-0569)", () => {
  it.live("counts a conversation's unread replies until the owner reads it", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start("Hello there");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting");
        const unread = yield* chronicle();
        expect(unread.find((each) => each.kind === "Replies" && each.threadId === quest.threadId)).toMatchObject({
          count: 1,
          isUnread: true,
          missionId: quest.missionId,
          source: "Quest",
        });
        yield* call({ _tag: "MarkThreadRead", threadId: quest.threadId });
        const after = yield* chronicle();
        expect(after.find((each) => each.kind === "Replies" && each.threadId === quest.threadId)).toBeUndefined();
        // The quest's own opening and its reply stay in the routine record, its routine events read.
        expect(after.find((each) => each.kind === "QuestOpened" && each.missionId === quest.missionId)).toMatchObject({
          isUnread: false,
        });
      }),
    ),
  );

  it.live("identifies the realm in its opening event", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", name: "Palace", path: null });
        expect((yield* chronicle()).find((each) => each.kind === "RealmOpened")).toMatchObject({
          source: "Realm",
          title: "Palace",
        });
      }),
    ),
  );

  it.live("identifies replies from a child thread as an errand", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start("Hello there");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting");
        const errand = yield* open(quest.threadId, "Hello from the errand");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting", errand.threadId);
        expect(
          (yield* chronicle()).find((each) => each.kind === "Replies" && each.threadId === errand.threadId),
        ).toMatchObject({ source: "Errand" });
      }),
    ),
  );

  it.live.each(["Allow", "AlwaysAllow", "Deny"] as const)("keeps a read request until the owner answers %s", (answer) =>
    withService(
      Effect.gen(function* () {
        const quest = yield* start('ask {"action":"Push the code","command":"git push"}');
        const detail = yield* settle(quest.missionId, (current) => current.thread.state === "Attention");
        const question = detail.questions.find((asked) => asked.outcome === null);
        if (question === undefined) return yield* Effect.die("Missing approval question");
        const unread = yield* chronicle();
        expect(unread.find((each) => each.kind === "Waiting" && each.threadId === quest.threadId)).toMatchObject({
          isUnread: true,
          questionId: question.id,
        });
        yield* call({ _tag: "MarkThreadRead", threadId: quest.threadId });
        const after = yield* chronicle();
        const waiting = after.find((each) => each.kind === "Waiting" && each.threadId === quest.threadId);
        expect(waiting).toMatchObject({ isUnread: false });
        expect(after.filter((each) => each.kind === "Waiting" && each.threadId === quest.threadId)).toHaveLength(1);
        yield* call({ _tag: "AnswerQuestion", answer, message: null, questionId: question.id });
        const answered = yield* chronicle();
        expect(answered.find((each) => each.kind === "Waiting" && each.threadId === quest.threadId)).toBeUndefined();
      }),
    ),
  );

  it.live("records a quest's move in the history", () =>
    withService(
      Effect.gen(function* () {
        yield* call({ _tag: "CreateRealm", name: "Palace", path: null });
        const quest = yield* start("Hello there");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Resting");
        const list = yield* call({
          _tag: "ListMissions",
          isArchived: false,
          search: null,
          state: null,
          workspaceId: null,
        });
        const palace = list.workspaces.find((workspace) => workspace.name === "Palace");
        expect(palace).toBeDefined();
        yield* call({ _tag: "MoveQuest", missionId: quest.missionId, realmId: palace?.id ?? null });
        const after = yield* chronicle();
        expect(after.find((each) => each.kind === "Moved" && each.missionId === quest.missionId)).toMatchObject({
          isUnread: false,
          realmId: palace?.id ?? null,
        });
      }),
    ),
  );
});
