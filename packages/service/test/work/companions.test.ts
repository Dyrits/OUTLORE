import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { companionRows, isRested, repliesOf, restedQuest, token, turnCountOf } from "../fixtures/companions.ts";
import { read, send, settle, withService } from "../fixtures/service.ts";

// A message that names a Companion with @ (thread-messaging, Mentioning a Companion with @; CHG-0781, CHG-0786): the
// named model answers in a hidden quest of its own, its answer is copied under the owner's message, and the
// conversation's own Companion carries on untouched.

describe("asking a Companion with @", () => {
  it.live("answers in the same conversation under the owner's message, once, labelled with its model", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        const sent = yield* send(quest.threadId, `${token("gpt-5")} what is two plus two`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length > 0);
        const [reply] = repliesOf(detail, "gpt-5");
        expect(reply?.text).toContain("what is two plus two");
        expect(reply).toMatchObject({ harness: "codex", model: "gpt-5", replyToMessageId: sent.messageId });
        expect(reply?.fromTitle).not.toBeNull();
        const owner = detail.messages.find((message) => message.id === sent.messageId);
        expect(owner).toMatchObject({ isDelivered: true, isQueued: false, sender: "user" });
        // The host says which message is a Companion's answer, so no client has to guess from the reply anchor.
        expect(reply?.isCompanionAnswer).toBe(true);
        expect(detail.messages.filter((message) => message.isCompanionAnswer === true)).toHaveLength(1);
        yield* Effect.sleep("150 millis");
        expect(repliesOf(yield* read(quest.missionId), "gpt-5")).toHaveLength(1);
      }),
    ),
  );

  it.live("leaves the main Companion's turns, state and session as they were", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        yield* send(quest.threadId, `${token("gpt-5")} hello there`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length > 0);
        expect(yield* turnCountOf(quest.threadId)).toBe(1);
        const detail = yield* read(quest.missionId);
        expect(detail.thread).toMatchObject({ harness: "claude", state: "Resting" });
        expect(detail.thread.actions.isInTurn).toBe(false);
      }),
    ),
  );

  it.live("answers while the main Companion is in a turn, which carries on", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, "wait 200\nMain work");
        yield* settle(quest.missionId, (detail) => detail.thread.state === "Underway");
        yield* send(quest.threadId, `${token("gpt-5")} side question`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length > 0);
        // The main Companion's own turn was not ended or replaced by the other model's.
        const detail = yield* settle(
          quest.missionId,
          (current) =>
            isRested(current) &&
            current.messages.filter((message) => message.sender === "agent" && message.model === null).length === 2,
        );
        expect(detail.thread.harness).toBe("claude");
        expect(yield* turnCountOf(quest.threadId)).toBe(2);
      }),
    ),
  );

  it.live("keeps one thread per model and conversation: a second mention resumes it, another model gets its own", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} first`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        yield* send(quest.threadId, `${token("gpt-5")} second`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 2);
        // The second question carries only what was said since the first answer, and no copy of the first exchange.
        expect(repliesOf(detail, "gpt-5")[1]?.text).not.toContain("first");
        const rows = yield* companionRows;
        expect(rows).toHaveLength(1);
        expect(yield* turnCountOf(rows[0]?.threadId ?? "")).toBe(2);
        yield* send(quest.threadId, `${token("gpt-6")} third`);
        yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-6").length === 1);
        expect(yield* companionRows).toHaveLength(2);
      }),
    ),
  );

  it.live("shows a later Companion what was said since it last looked", () =>
    withService(
      Effect.gen(function* () {
        const quest = yield* restedQuest;
        yield* send(quest.threadId, `${token("gpt-5")} first`);
        yield* settle(quest.missionId, (detail) => repliesOf(detail, "gpt-5").length === 1);
        yield* send(quest.threadId, "A remark between");
        yield* settle(
          quest.missionId,
          (detail) => isRested(detail) && detail.messages.at(-1)?.text.includes("A remark between") === true,
        );
        yield* send(quest.threadId, `${token("gpt-5")} second`);
        const detail = yield* settle(quest.missionId, (current) => repliesOf(current, "gpt-5").length === 2);
        expect(repliesOf(detail, "gpt-5")[1]?.text).toContain("A remark between");
      }),
    ),
  );
});
