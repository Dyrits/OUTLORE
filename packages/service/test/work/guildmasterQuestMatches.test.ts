import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { guildmaster, isIdle, listed, say, startIdle } from "../fixtures/guildmaster.ts";
import { fixture, read, settle, tool } from "../fixtures/service.ts";
import { answer, folderIn, questOf } from "./guildmasterHelpers.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("finding a quest that already fits", () => {
  it.live("finds the quest on the same ticket, though its title and briefing never name it", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const first = yield* startIdle(
        "Fix the checkout total rounding. Ticket PAY-481, see https://tracker.example/browse/PAY-481",
      );
      yield* startIdle("Compare lunch options");
      const found = yield* tool(place.threadId, "find_missions", { request: "Please take PAY-481 for me" });
      expect(found).toContain(first.missionId);
      expect(found).not.toContain("lunch");
      const byLink = yield* tool(place.threadId, "find_missions", {
        request: "https://tracker.example/browse/PAY-481/",
      });
      expect(byLink).toContain(first.missionId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("ranks a shared ticket above shared words and never offers the Guildmaster itself", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const wordy = yield* startIdle("Checkout total rounding review");
      const ticket = yield* startIdle("Billing work for ticket PAY-481");
      const found = yield* tool(place.threadId, "find_missions", { request: "Checkout total rounding, PAY-481" });
      expect(found.indexOf(ticket.missionId)).toBeLessThan(found.indexOf(wordy.missionId));
      expect(found).not.toContain(place.missionId);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("offers Continue in, then sends the owner's words to the chosen quest", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const existing = yield* startIdle("Fix the checkout total rounding, ticket PAY-481");
      const args = {
        missions: [existing.missionId],
        text: "Take PAY-481 again, with the rounding bug",
        title: "PAY-481",
      };
      yield* say(place.threadId, `call suggest_mission ${JSON.stringify(args)}`);
      const waiting = yield* settle(
        place.missionId,
        (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === null),
        place.threadId,
      );
      const card = waiting.suggestions.find((suggestion) => suggestion.outcome === null);
      if (card === undefined) return yield* Effect.die("Missing card");
      expect(card.isFromGuildmaster).toBe(true);
      expect(card.matches.map((match) => match.missionId)).toEqual([existing.missionId]);
      const asAside = yield* Effect.flip(answer(card, { _tag: "Aside" }));
      expect(JSON.stringify(asAside)).toContain("keeps no asides");
      yield* answer(card, { _tag: "Continue", missionId: existing.missionId });
      const continued = yield* settle(
        existing.missionId,
        (detail) => detail.messages.filter((message) => message.sender === "user").length === 2,
      );
      expect(continued.messages.filter((message) => message.sender === "user").at(-1)?.text).toBe(
        "Take PAY-481 again, with the rounding bug",
      );
      expect((yield* listed).missions).toHaveLength(1);
      const done = yield* settle(
        place.missionId,
        (detail) => isIdle(detail) && detail.suggestions.every((suggestion) => suggestion.outcome !== null),
        place.threadId,
      );
      expect(done.suggestions[0]).toMatchObject({ outcome: "Continued", targetMissionId: existing.missionId });
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("opens a new quest in the realm the owner named when the owner chooses to open one anyway", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const folder = folderIn(directory, "billing");
      const existing = yield* startIdle("Fix the checkout total rounding, ticket PAY-481", folder);
      const place = yield* guildmaster;
      const args = {
        missions: [existing.missionId],
        realm: "billing",
        text: "A second look at PAY-481",
        title: "Second look",
      };
      yield* say(place.threadId, `call suggest_mission ${JSON.stringify(args)}`);
      const waiting = yield* settle(
        place.missionId,
        (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === null),
        place.threadId,
      );
      const card = waiting.suggestions.find((suggestion) => suggestion.outcome === null);
      if (card === undefined) return yield* Effect.die("Missing card");
      yield* answer(card, { _tag: "NewMission", effort: "default", model: "default" });
      const done = yield* settle(
        place.missionId,
        (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === "MovedToMission"),
        place.threadId,
      );
      const opened = yield* read(yield* questOf(done.suggestions[0]));
      expect(opened.thread.workspace?.path).toBe(folder);
      expect(opened.mission.title).toBe("Second look");
    }).pipe(Effect.provide(layer));
  });
});
