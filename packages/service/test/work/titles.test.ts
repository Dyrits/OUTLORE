import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { afterEach } from "vitest";
import { prepareStartingContext } from "../../src/work/startingContext.ts";
import { namingLineOf } from "../../src/work/titles.ts";
import { call, fixture, open, send, settle, start, tool } from "../fixtures/service.ts";

const fixtures: ReturnType<typeof fixture>[] = [];
const live = () => {
  const value = fixture();
  fixtures.push(value);
  return value;
};
afterEach(() => {
  for (const value of fixtures.splice(0)) value.remove();
});

/** A mission whose top thread has finished its first turn. */
const idle = (text = "Hello") =>
  Effect.gen(function* () {
    const started = yield* start(text);
    yield* settle(started.missionId, (detail) => detail.thread.state === "Resting");
    return started;
  });

describe("asking unnamed quests and errands to name themselves", () => {
  it("asks only quests still called Quest and errands still called Errand, never Chronicler, asides, or owner-named quests", () => {
    expect(
      namingLineOf({
        isGuildmaster: false,
        isTitleByUser: false,
        position: { isAside: false, parent: null, title: "Quest" },
      }),
    ).toContain('It is still "Quest": call set_mission_title now');
    expect(
      namingLineOf({
        isGuildmaster: false,
        isTitleByUser: false,
        position: { isAside: false, parent: { id: "p", title: "Q" }, title: "Errand" },
      }),
    ).toContain('It is still "Errand": call set_mission_title now');
    expect(
      namingLineOf({
        isGuildmaster: true,
        isTitleByUser: false,
        position: { isAside: false, parent: null, title: "Quest" },
      }),
    ).toBeNull();
    expect(
      namingLineOf({
        isGuildmaster: false,
        isTitleByUser: true,
        position: { isAside: false, parent: null, title: "Quest" },
      }),
    ).toBeNull();
    expect(
      namingLineOf({
        isGuildmaster: false,
        isTitleByUser: false,
        position: { isAside: true, parent: { id: "p", title: "Q" }, title: "Errand" },
      }),
    ).toBeNull();
    expect(
      namingLineOf({
        isGuildmaster: false,
        isTitleByUser: false,
        position: { isAside: false, parent: null, title: "Named" },
      }),
    ).toBeNull();
    expect(
      namingLineOf({
        isGuildmaster: false,
        isTitleByUser: false,
        position: { isAside: false, parent: { id: "p", title: "Q" }, title: "Named" },
      }),
    ).toBeNull();
  });

  it.live("keeps asking an unnamed quest on a later turn, and stops once it names itself", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const first = yield* prepareStartingContext(threadId);
      expect(first.note.startsWith('Your title: "Quest". It is still "Quest": call set_mission_title now')).toBe(true);
      // A second turn with no rename still carries the naming line.
      yield* send(threadId, "Still working on this.");
      yield* settle(missionId, (detail) => detail.thread.state === "Resting");
      const second = yield* prepareStartingContext(threadId);
      expect(second.note.startsWith('Your title: "Quest". It is still "Quest": call set_mission_title now')).toBe(true);
      // The system part is the same before and after naming: the nudge restarts nothing.
      yield* tool(threadId, "set_mission_title", { title: "Release planning" });
      const named = yield* prepareStartingContext(threadId);
      expect(named.note).not.toContain("call set_mission_title");
      expect(named.context).toBe(first.context);
    }).pipe(Effect.provide(layer));
  });

  it.live("stops asking a quest once the owner renames it without changing the system part", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      const unnamed = yield* prepareStartingContext(threadId);
      yield* call({ _tag: "RenameMission", missionId, title: "Owner title" });
      const named = yield* prepareStartingContext(threadId);
      expect(named.note).not.toContain("call set_mission_title");
      expect(named.context).toBe(unnamed.context);
    }).pipe(Effect.provide(layer));
  });

  it.live("stops asking a quest when the owner explicitly renames it to Quest", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { missionId, threadId } = yield* idle();
      yield* call({ _tag: "RenameMission", missionId, title: "Quest" });
      const { note } = yield* prepareStartingContext(threadId);
      expect(note).not.toContain("call set_mission_title");
    }).pipe(Effect.provide(layer));
  });

  it.live("asks an errand still called Errand to name itself, and stops once it does", () => {
    const { layer } = live();
    return Effect.gen(function* () {
      const { threadId } = yield* idle("Plan the release.");
      const child = yield* open(threadId, "Draft the notes.");
      const unnamed = yield* prepareStartingContext(child.threadId);
      expect(unnamed.note).toContain('It is still "Errand": call set_mission_title now');
      yield* tool(child.threadId, "set_mission_title", { title: "Draft release notes" });
      const named = yield* prepareStartingContext(child.threadId);
      expect(named.note).not.toContain("call set_mission_title");
      expect(named.context).toBe(unnamed.context);
    }).pipe(Effect.provide(layer));
  });
});
