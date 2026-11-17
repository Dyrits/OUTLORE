import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { call, fixture, settle } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("recording a reply's model", () => {
  it.live("keeps the thread's chosen model on a reply the harness did not name a model for", () => {
    const value = fixture();
    fixtures.push(value);
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "sonnet",
        requestId: crypto.randomUUID(),
        text: "Hello",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, (detail) => detail.thread.state === "Idle");
      expect(detail.messages.filter((message) => message.sender === "agent").map((message) => message.model)).toEqual([
        "sonnet",
      ]);
    }).pipe(Effect.provide(value.layer));
  });

  it.live("leaves the model empty when the thread uses the harness's default", () => {
    const value = fixture();
    fixtures.push(value);
    return Effect.gen(function* () {
      const started = yield* call({
        _tag: "StartMission",
        effort: "default",
        model: "default",
        requestId: crypto.randomUUID(),
        text: "Hello",
        workspacePath: null,
      });
      const detail = yield* settle(started.missionId, (detail) => detail.thread.state === "Idle");
      expect(detail.messages.filter((message) => message.sender === "agent").map((message) => message.model)).toEqual([
        null,
      ]);
    }).pipe(Effect.provide(value.layer));
  });
});
