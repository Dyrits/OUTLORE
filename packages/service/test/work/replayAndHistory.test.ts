import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { afterEach } from "vitest";
import { readConversationSoFar } from "../../src/work/handover.ts";
import { guildmaster, isIdle, say } from "../fixtures/guildmaster.ts";
import { fixture, open, read, settle, start, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value.layer;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("replaying a conversation and reading Chronicler's history", () => {
  it.live("omits the oldest message beyond half the context window and says how many", () =>
    Effect.gen(function* () {
      const started = yield* start("Old message");
      yield* settle(started.missionId, isIdle);
      const sql = yield* SqlClient.SqlClient;
      const longText = "x".repeat(400_001);
      yield* sql`UPDATE messages SET text = ${longText} WHERE thread_id = ${started.threadId} AND sender_kind = 'user'`;
      const history = yield* readConversationSoFar(started.threadId, "next-turn", "default");
      expect(history).toContain("1 earlier message was left out");
      expect(history).not.toContain(longText);
      expect(history).toContain("You: Echo: Old message");
    }).pipe(Effect.provide(setup())),
  );

  it.live("replays delivered messages and results from another thread with their sender", () =>
    Effect.gen(function* () {
      const started = yield* start("Hello");
      yield* settle(started.missionId, isIdle);
      const child = yield* open(started.threadId, "Hello child");
      yield* settle(started.missionId, isIdle, child.threadId);
      yield* tool(child.threadId, "send_thread_message", { text: "A note", to: started.threadId });
      yield* settle(
        started.missionId,
        (detail) => detail.messages.some((message) => message.text === "A note") && isIdle(detail),
      );
      yield* tool(child.threadId, "report_result", { journal: "nothing to record", result: "A result" });
      yield* settle(
        started.missionId,
        (detail) => detail.messages.some((message) => message.text === "A result") && isIdle(detail),
      );
      const history = yield* readConversationSoFar(started.threadId, "next-turn", "default");
      expect(history).toMatch(/Thread "[^"]+": A note/);
      expect(history).toMatch(/Result from thread "[^"]+": A result/);
      expect((yield* read(started.missionId)).thread.state).toBe("Resting");
    }).pipe(Effect.provide(setup())),
  );

  it.live("pages Chronicler's messages newest first and filters the query", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* say(place.threadId, "Needle first");
      yield* settle(place.missionId, isIdle, place.threadId);
      yield* say(place.threadId, "Needle second");
      yield* settle(place.missionId, isIdle, place.threadId);
      const first = yield* tool(place.threadId, "read_control_history", { count: 1, query: "needle" });
      const sequence = Number(first.match(/^#(\d+)/)?.[1]);
      expect(first).toContain("Needle second");
      const earlier = yield* tool(place.threadId, "read_control_history", {
        before: sequence,
        count: 1,
        query: "needle",
      });
      expect(earlier).toContain("Needle second");
      const earlierSequence = Number(earlier.match(/^#(\d+)/)?.[1]);
      const oldest = yield* tool(place.threadId, "read_control_history", {
        before: earlierSequence,
        count: 1,
        query: "needle",
      });
      expect(oldest).toContain("Needle first");
    }).pipe(Effect.provide(setup())),
  );
});
