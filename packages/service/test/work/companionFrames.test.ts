import { describe, expect, it } from "@effect/vitest";
import { MessageId, type ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { companionRows, isRested, repliesOf, restedQuest, token, turnCountOf } from "../fixtures/companions.ts";
import { call, read, send, settle, withService } from "../fixtures/service.ts";

// Framed Companion follow-ups and opt-in context sharing (thread-messaging, Mentioning a Companion with @; CHG-0787).

const followUp = (threadId: ThreadId, frameMessageId: MessageId, requestId: string, text: string) =>
  call({
    _tag: "SendMessage",
    attachmentIds: [],
    delivery: null,
    frameMessageId,
    requestId,
    text,
    threadId,
  });

describe("framed Companion context sharing", () => {
  it.live("keeps a frame out of the main Companion's context until shared, then tells it once without waking it", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const sent = yield* send(quest.threadId, `${token("gpt-5")} Sky colour?`);
        const answered = yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        expect(answered.messages.find((message) => message.id === sent.messageId)?.companionFrameContext).toBe("None");
        yield* Effect.sleep("100 millis");
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        // Before sharing, the main Companion does not receive the side conversation as context.
        yield* send(quest.threadId, "Before sharing");
        const before = yield* settle(
          quest.missionId,
          (current) => isRested(current) && current.messages.at(-1)?.text.includes("Before sharing") === true,
        );
        expect(before.messages.at(-1)?.text).not.toContain("Sky colour?");
        // Sharing marks the frame as Shared without waking the main Companion.
        yield* call({ _tag: "ShareCompanionFrame", frameMessageId: sent.messageId, threadId: quest.threadId });
        const shared = yield* read(quest.missionId);
        expect(shared.messages.find((message) => message.id === sent.messageId)?.companionFrameContext).toBe("Shared");
        yield* Effect.sleep("100 millis");
        expect(yield* turnCountOf(quest.threadId)).toBe(2);
        // The main Companion's next turn receives the shared exchange once.
        yield* send(quest.threadId, "Carry on");
        const detail = yield* settle(
          quest.missionId,
          (current) => isRested(current) && current.messages.at(-1)?.text.includes("Carry on") === true,
        );
        const told = detail.messages.at(-1)?.text ?? "";
        expect(told).toContain("gpt-5");
        expect(told).toContain("Sky colour?");
        expect(told).toContain("context only");
        yield* send(quest.threadId, "Once more");
        const later = yield* settle(
          quest.missionId,
          (current) => isRested(current) && current.messages.at(-1)?.text.includes("Once more") === true,
        );
        expect(later.messages.at(-1)?.text).not.toContain("Sky colour?");
        expect(yield* turnCountOf(quest.threadId)).toBe(4);
      }),
    ),
  );

  it.live("marks a shared frame Outdated after a later follow-up and delivers the new answer once shared again", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const opening = yield* send(quest.threadId, `${token("gpt-5")} First question`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        yield* call({ _tag: "ShareCompanionFrame", frameMessageId: opening.messageId, threadId: quest.threadId });
        yield* followUp(quest.threadId, opening.messageId, "req-outdated-1", "Tell me more");
        const afterFollowUp = yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 2);
        expect(afterFollowUp.messages.find((message) => message.id === opening.messageId)?.companionFrameContext).toBe(
          "Outdated",
        );
        yield* call({ _tag: "ShareCompanionFrame", frameMessageId: opening.messageId, threadId: quest.threadId });
        const updated = yield* read(quest.missionId);
        expect(updated.messages.find((message) => message.id === opening.messageId)?.companionFrameContext).toBe(
          "Shared",
        );
        yield* send(quest.threadId, "Main carry on");
        const mainTurn = yield* settle(
          quest.missionId,
          (current) => isRested(current) && current.messages.at(-1)?.text.includes("Main carry on") === true,
        );
        expect(mainTurn.messages.at(-1)?.text).toContain("Tell me more");
      }),
    ),
  );

  it.live("reads pre-0083 rows with null frame_message_id and already-delivered context as Shared", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const opening = yield* send(quest.threadId, `${token("gpt-5")} Legacy question`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const sql = yield* SqlClient.SqlClient;
        // Simulate a row saved before migration 0083 that was already delivered to a turn.
        yield* sql`UPDATE companion_exchanges SET frame_message_id = NULL, is_context_shared = 0, context_turn_id = 'legacy-turn'
          WHERE owner_message_id = ${opening.messageId}`;
        const detail = yield* read(quest.missionId);
        expect(detail.messages.find((message) => message.id === opening.messageId)?.companionFrameContext).toBe(
          "Shared",
        );
        expect(repliesOf(detail, "gpt-5")[0]?.companionFrameId).toBe(opening.messageId);
        // Following up on the pre-0083 frame still resolves its Companion.
        yield* followUp(quest.threadId, opening.messageId, "req-legacy-follow", "Follow up legacy");
        const next = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 2);
        expect(next.messages.find((message) => message.id === opening.messageId)?.companionFrameContext).toBe(
          "Outdated",
        );
      }),
    ),
  );
});

describe("in-frame Companion follow-ups", () => {
  it.live("addresses the frame's existing Companion without re-typing @ and attaches companionFrameId", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const opening = yield* send(quest.threadId, `${token("gpt-5")} First question`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        const sent = yield* followUp(quest.threadId, opening.messageId, "req-follow-1", "Tell me more");
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 2);
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        expect(detail.messages.find((message) => message.id === sent.messageId)?.companionFrameId).toBe(
          opening.messageId,
        );
        expect(repliesOf(detail, "gpt-5")[1]?.companionFrameId).toBe(opening.messageId);
      }),
    ),
  );

  it.live("pulls in another @-mentioned Companion alongside existing frame Companions", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const opening = yield* send(quest.threadId, `${token("gpt-5")} First question`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        yield* followUp(quest.threadId, opening.messageId, "req-pull-1", `${token("gpt-6")} Second opinion?`);
        const detail = yield* settle(
          quest.missionId,
          (current) => repliesOf(current, "gpt-5").length === 2 && repliesOf(current, "gpt-6").length === 1,
        );
        expect(repliesOf(detail, "gpt-6")[0]?.companionFrameId).toBe(opening.messageId);
      }),
    ),
  );

  it.live("deduplicates existing Companions and caps combined follow-up targets at five", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const opening = yield* send(quest.threadId, `${token("gpt-1")} ${token("gpt-2")} Opening`);
        yield* settle(
          quest.missionId,
          (current) => repliesOf(current, "gpt-1").length === 1 && repliesOf(current, "gpt-2").length === 1,
        );
        // Re-mention gpt-1 and add four more (total 6 distinct); only the first five answer.
        yield* followUp(
          quest.threadId,
          opening.messageId,
          "req-cap-1",
          `${token("gpt-1")} ${token("gpt-3")} ${token("gpt-4")} ${token("gpt-5")} ${token("gpt-6")} Cap check`,
        );
        const detail = yield* settle(
          quest.missionId,
          (current) =>
            repliesOf(current, "gpt-1").length === 2 &&
            repliesOf(current, "gpt-2").length === 2 &&
            repliesOf(current, "gpt-3").length === 1 &&
            repliesOf(current, "gpt-4").length === 1 &&
            repliesOf(current, "gpt-5").length === 1,
        );
        yield* Effect.sleep("100 millis");
        expect(repliesOf(yield* read(quest.missionId), "gpt-6")).toHaveLength(0);
        expect(repliesOf(detail, "gpt-1")).toHaveLength(2);
        expect(yield* companionRows).toHaveLength(5);
      }),
    ),
  );

  it.live("rejects an unknown frameMessageId on SendMessage even with @ mentions, and on ShareCompanionFrame", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const missing = MessageId.make("no-such-frame");
        const plainError = yield* Effect.flip(followUp(quest.threadId, missing, "req-bad-1", "Hello"));
        expect(plainError.message).toContain("No such side conversation");
        const mentionError = yield* Effect.flip(
          followUp(quest.threadId, missing, "req-bad-2", `${token("gpt-5")} Sneaky`),
        );
        expect(mentionError.message).toContain("No such side conversation");
        const shareError = yield* Effect.flip(
          call({ _tag: "ShareCompanionFrame", frameMessageId: missing, threadId: quest.threadId }),
        );
        expect(shareError.message).toContain("No such side conversation");
      }),
    ),
  );
});
