import { join } from "node:path";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { call, settle, startMission } from "../fixtures/service.ts";
import { answerOpen, idleWith, replies, withHarnesses } from "../fixtures/standIns.ts";

const _standIn = [join(import.meta.dirname, "..", "fixtures", "stand-in-opencode.mjs")];
const _spawnChild = join(import.meta.dirname, "..", "fixtures", "stand-in-spawn-child.mjs");
describe("asking the owner before OpenCode acts", () => {
  it.live("carries on in the same turn after the owner's refusal cancels OpenCode's prompt", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run git push origin main" });
      yield* answerOpen("Deny");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        "Echo: Outlore refused the command `git push origin main`. Not approved by the owner. Do not do this action; carry on without it. ",
      ]);
      expect(requests("session/prompt")).toHaveLength(2);
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 80, input: 180, output: 16 });
    }).pipe(Effect.provide(layer));
  });

  it.live("gives OpenCode the owner's message with a refusal", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: `edit ${outside}` });
      yield* answerOpen("Deny", "Write it in the notes folder instead.");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        `Echo: Outlore refused the change to \`${outside}\`. Denied by the owner: Write it in the notes folder instead. `,
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks about the file outside the folder when one edit names a file inside and one outside", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: `edit inside.txt and ${outside}` });
      const detail = yield* settle(started.missionId, (current) => current.questions.length === 1);
      expect(detail.questions[0]?.details).toContain(outside);
      expect(detail.questions[0]?.outcome).toBeNull();
    }).pipe(Effect.provide(layer));
  });

  it.live("sends no refusal after an interrupt cancels a prompt waiting on a question", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run git push origin main" });
      yield* settle(started.missionId, (detail) => detail.questions.length === 1);
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      yield* Effect.sleep("200 millis");
      expect(replies(detail)).toEqual([]);
      expect(requests("session/prompt")).toHaveLength(1);
    }).pipe(Effect.provide(layer));
  });

  it.live("keeps the usage of a turn's earlier prompts when OpenCode exits during an interrupt", () => {
    const { layer, requests } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "fragile run git push origin main" });
      yield* answerOpen("Deny");
      for (let attempt = 0; attempt < 100 && requests("session/prompt").length < 2; attempt++)
        yield* Effect.sleep("10 millis");
      yield* call({ _tag: "InterruptThread", threadId: started.threadId });
      const detail = yield* settle(started.missionId, (current) => current.thread.state === "Idle");
      expect(detail.mission.usage).toEqual({ cacheCreation: 0, cacheRead: 40, input: 90, output: 8 });
    }).pipe(Effect.provide(layer));
  });

  it.live("lets an edit inside the thread's folder run without a question", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "edit notes/plan.md" });
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["notes/plan.md: once "]);
      expect(detail.questions).toEqual([]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner before an edit outside the thread's folder", () => {
    const { directory, layer } = withHarnesses();
    const outside = join(directory, "outside.txt");
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: `edit ${outside}` });
      const answered = yield* answerOpen("Deny");
      expect(answered.details).toBe(`Edit ${outside}\n${JSON.stringify({ file_path: outside }, null, 2)}`);
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual([
        `Echo: Outlore refused the change to \`${outside}\`. Not approved by the owner. Do not do this action; carry on without it. `,
      ]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks the owner before a relative edit that climbs out of the thread's folder", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "edit ../../outside.txt" });
      yield* answerOpen("Allow");
      const detail = yield* settle(started.missionId, idleWith(1));
      expect(replies(detail)).toEqual(["../../outside.txt: once "]);
    }).pipe(Effect.provide(layer));
  });

  it.live("asks before every command when no sandbox protects OpenCode, naming it exactly", () => {
    const { layer } = withHarnesses();
    return Effect.gen(function* () {
      const started = yield* startMission({ harness: "opencode", text: "run ls" });
      const answered = yield* answerOpen("Allow");
      expect(answered).toMatchObject({ details: "ls", permission: "Run without a sandbox" });
      expect(replies(yield* settle(started.missionId, idleWith(1)))).toEqual(["ls: once "]);
    }).pipe(Effect.provide(layer));
  });
});
