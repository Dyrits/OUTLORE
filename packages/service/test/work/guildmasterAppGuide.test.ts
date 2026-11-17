import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { guildmaster, startIdle } from "../fixtures/guildmaster.ts";
import { fixture, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("reading Chronicler's app guide", () => {
  it.live("lists the topics when called with none, and reads one by its id", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const index = yield* tool(place.threadId, "read_app_guide", {});
      expect(index).toContain("- rituals:");
      expect(index).toContain("say you do not know");
      const topic = yield* tool(place.threadId, "read_app_guide", { topic: "rituals" });
      expect(topic).toContain("Run now");
      expect(topic).toContain("Answer only from this guide");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("finds a topic from the words of a question, and says when the guide has none", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      expect(yield* tool(place.threadId, "read_app_guide", { topic: "how do I pair my phone?" })).toContain(
        "one-time pairing code",
      );
      const none = yield* tool(place.threadId, "read_app_guide", { topic: "what is the capital of France" });
      expect(none).toContain("does not cover");
      expect(none).toContain("say you do not know");
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("keeps the guide to Chronicler: a quest's thread is refused", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Some quest");
      expect(yield* tool(quest.threadId, "read_app_guide", {})).toContain("Only Chronicler");
    }).pipe(Effect.provide(setup().layer)),
  );
});
