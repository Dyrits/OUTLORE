import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { guildmaster, lastAgentText, startIdle } from "../fixtures/guildmaster.ts";
import { call, fixture, send, settle, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("reading and messaging across quests", () => {
  it.live("reads another quest's journal, which only the Guildmaster may", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const quest = yield* startIdle("Plan the trip");
      yield* call({
        _tag: "RewriteBriefing",
        basedOn: 0,
        briefing: "Booking flights to Lisbon.",
        entry: null,
        missionId: quest.missionId,
        requestId: crypto.randomUUID(),
      });
      expect(yield* tool(place.threadId, "read_journal", { mission: quest.missionId })).toContain(
        "Booking flights to Lisbon",
      );
      expect(yield* tool(quest.threadId, "read_journal", { mission: quest.missionId })).toContain("Only Chronicler");
      expect(yield* tool(place.threadId, "read_journal", { mission: place.missionId })).toBe("No such quest.");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("lets any thread message the Guildmaster, which forwards to a quest's top thread", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const asker = yield* startIdle("Asker");
      const target = yield* startIdle("Target");
      const other = yield* startIdle("Other");
      expect(
        yield* tool(asker.threadId, "send_thread_message", {
          text: "Which quest handles the invoices?",
          to: place.threadId,
        }),
      ).toBe("Sent.");
      yield* settle(
        place.missionId,
        (detail) => detail.messages.some((message) => message.text.includes("invoices")),
        place.threadId,
      );
      expect(
        yield* tool(place.threadId, "send_thread_message", { text: "Please take the invoices.", to: target.threadId }),
      ).toBe("Sent.");
      const received = yield* settle(target.missionId, (detail) =>
        detail.messages.some((message) => message.text.includes("take the invoices")),
      );
      expect(received.messages.find((message) => message.text.includes("take the invoices"))?.sender).toBe("thread");
      expect(yield* tool(asker.threadId, "send_thread_message", { text: "Hello", to: other.threadId })).toContain(
        "Not sent",
      );
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("tells every other thread where the Guildmaster is", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const quest = yield* startIdle("context");
      yield* send(quest.threadId, "context");
      const detail = yield* settle(quest.missionId, (detail) => lastAgentText(detail).includes("Chronicler, thread"));
      expect(lastAgentText(detail)).toContain(place.threadId);
    }).pipe(Effect.provide(setup().layer)),
  );
});
