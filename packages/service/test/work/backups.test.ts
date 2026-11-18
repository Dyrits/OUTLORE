import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, codexBackup, fixture, open, read, send, settle, start } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});
const withService = <A, E, R>(body: Effect.Effect<A, E, R>) => {
  const value = fixture();
  fixtures.push(value);
  return body.pipe(Effect.provide(value.layer));
};
const replies = (detail: { messages: ReadonlyArray<{ sender: string; text: string }> }) =>
  detail.messages.filter((message) => message.sender === "agent").map((message) => message.text);

describe("saving a thread's backup Companions", () => {
  it.live("are saved in order and shown in the thread's panel", () =>
    withService(
      Effect.gen(function* () {
        const { threadId } = yield* start("Hello");
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([]);
        yield* call({ _tag: "SetThreadBackups", backups: [codexBackup], threadId });
        expect((yield* call({ _tag: "ReadThreadPanel", threadId })).backups).toEqual([codexBackup]);
      }),
    ),
  );

  it.live("take over a failed turn, and the line says why", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [codexBackup], threadId });
        yield* send(threadId, "fail claude Usage limit reached\nrunner");
        const detail = yield* settle(
          missionId,
          (detail) => replies(detail).length === 2 && detail.thread.state === "Idle",
        );
        expect(replies(detail)[1]).toContain("codex/gpt-5");
        expect(detail.handovers.map((handover) => handover.text)).toEqual([
          expect.stringMatching(/^Fell back to Codex · gpt-5 · default effort · Usage limit reached/),
        ]);
      }),
    ),
  );

  it.live("do not replace a runner the owner chose during the failing turn", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        yield* call({ _tag: "SetThreadBackups", backups: [codexBackup], threadId });
        yield* send(threadId, "wait 300\nfail claude Usage limit reached");
        yield* settle(missionId, (detail) => detail.thread.state === "Running");
        yield* call({
          _tag: "ChangeThreadRunner",
          accountId: null,
          effort: "high",
          harness: "claude",
          model: "opus",
          threadId,
        });
        const detail = yield* settle(missionId, (current) => current.thread.state === "Failed");
        expect(detail.thread.model).toBe("opus");
        expect(detail.thread.harness).toBe("claude");
        expect(detail.handovers).toEqual([]);
      }),
    ),
  );

  it.live("leave a failed thread Failed when it has none", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("fail claude no");
        yield* settle(missionId, (detail) => detail.thread.state === "Failed");
        expect((yield* read(missionId, threadId)).handovers).toEqual([]);
      }),
    ),
  );
});

describe("marking an errand done", () => {
  it.live("ends only the errand, and refuses the quest's own thread", () =>
    withService(
      Effect.gen(function* () {
        const { missionId, threadId } = yield* start("Hello");
        yield* settle(missionId, (detail) => detail.thread.state === "Idle");
        const opened = yield* open(threadId, "wait 2000");
        yield* call({ _tag: "MarkThreadDone", threadId: opened.threadId });
        const detail = yield* read(missionId, opened.threadId);
        expect(detail.thread.state).toBe("Done");
        expect((yield* read(missionId, threadId)).thread.state).toBe("Idle");
        const refusal = yield* call({ _tag: "MarkThreadDone", threadId }).pipe(Effect.flip);
        expect(String(refusal)).toContain("mark the quest done");
      }),
    ),
  );
});
