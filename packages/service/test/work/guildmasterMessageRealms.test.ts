import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { guildmaster, lastAgentText, say, startIdle } from "../fixtures/guildmaster.ts";
import { fixture, send, settle } from "../fixtures/service.ts";
import { folderIn } from "./guildmasterHelpers.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("carrying a realm chosen for a message", () => {
  it.live("reaches the Guildmaster's turn with the message, and is kept on it", () => {
    const { directory, layer } = setup();
    return Effect.gen(function* () {
      const folder = folderIn(directory, "app");
      yield* startIdle("Existing work", folder);
      const place = yield* guildmaster;
      yield* say(place.threadId, "Fix the login bug", folder);
      const detail = yield* settle(place.missionId, (detail) => lastAgentText(detail) !== "", place.threadId);
      expect(lastAgentText(detail)).toContain("Fix the login bug");
      expect(lastAgentText(detail)).toContain(`The owner chose the realm "app" (${folder})`);
    }).pipe(Effect.provide(layer));
  });
});

// A plain owner message to a quest still carries no realm note.
describe("carrying no realm note in an ordinary quest", () => {
  it.live("is not told about realms in its messages", () =>
    Effect.gen(function* () {
      const quest = yield* startIdle("Hello there");
      yield* send(quest.threadId, "Another message");
      const detail = yield* settle(quest.missionId, (detail) => lastAgentText(detail).includes("Another message"));
      expect(lastAgentText(detail)).not.toContain("The owner chose the realm");
    }).pipe(Effect.provide(setup().layer)),
  );
});
