import { describe, expect, it } from "@effect/vitest";
import type { MissionDetail } from "@outlore/contracts";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { guildmaster, isIdle, startIdle } from "../fixtures/guildmaster.ts";
import { fixture, read, settle, start, tool } from "../fixtures/service.ts";
import { openByOwner } from "./guildmasterHelpers.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const setup = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

describe("hearing back from quests it opened", () => {
  const threadMessages = (detail: MissionDetail) =>
    detail.messages.filter((message) => message.sender === "thread").map((message) => message.text);

  it.live("is told once when a quest it opened reports its result, and not of quests it did not open", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const unrelated = yield* start('call report_result {"journal":"nothing to record","result":"done"}');
      yield* settle(unrelated.missionId, (detail) => detail.mission.prompt === "MarkDone");
      const text = 'call report_result {"journal":"nothing to record","result":"All checked"}';
      yield* openByOwner(place, { text, title: "Checks" });
      const told = yield* settle(
        place.missionId,
        (detail) => threadMessages(detail).some((report) => report.includes("reported its result")),
        place.threadId,
      );
      const reports = threadMessages(told);
      expect(reports).toHaveLength(1);
      expect(reports[0]).toContain('Quest "Checks"');
      yield* settle(place.missionId, isIdle, place.threadId);
      yield* Effect.sleep("300 millis");
      expect(threadMessages(yield* read(place.missionId, place.threadId))).toHaveLength(1);
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("labels each report with the quest it came from, so the conversation can link to it", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const missionId = yield* openByOwner(place, {
        text: 'call report_result {"journal":"nothing to record","result":"All checked"}',
        title: "Checks",
      });
      const told = yield* settle(
        place.missionId,
        (detail) => threadMessages(detail).some((report) => report.includes("reported its result")),
        place.threadId,
      );
      const report = told.messages.find((message) => message.sender === "thread");
      expect(report?.fromMissionId).toBe(missionId);
      // A message the Guildmaster sends to a quest names no quest to link to.
      const target = yield* startIdle("Target");
      yield* tool(place.threadId, "send_thread_message", { text: "Please take it.", to: target.threadId });
      const received = yield* settle(target.missionId, (detail) =>
        detail.messages.some((message) => message.text.includes("Please take it")),
      );
      expect(received.messages.find((message) => message.text.includes("Please take it"))?.fromMissionId).toBeNull();
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("is told when a quest it opened needs the owner", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      const text = 'ask {"action":"Push the commits","command":"git push origin main"}';
      yield* openByOwner(place, { text, title: "Pushing" });
      const told = yield* settle(
        place.missionId,
        (detail) => threadMessages(detail).some((report) => report.includes("needs the owner")),
        place.threadId,
      );
      expect(threadMessages(told)[0]).toContain('Quest "Pushing"');
    }).pipe(Effect.provide(setup().layer)),
  );

  it.live("is told when a quest it opened fails, with the reason", () =>
    Effect.gen(function* () {
      const place = yield* guildmaster;
      yield* openByOwner(place, { text: "fail claude Usage limit reached", title: "Doomed" });
      const told = yield* settle(
        place.missionId,
        (detail) => threadMessages(detail).some((report) => report.includes("failed")),
        place.threadId,
      );
      expect(threadMessages(told)[0]).toContain("Usage limit reached");
    }).pipe(Effect.provide(setup().layer)),
  );
});
