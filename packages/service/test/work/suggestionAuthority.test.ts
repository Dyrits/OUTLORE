import { describe, expect, it } from "@effect/vitest";
import type { MissionId, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { isIdle } from "../fixtures/guildmaster.ts";
import { call, read, send, settle, start, withService } from "../fixtures/service.ts";

// mission-coordination, External contract: text another thread wrote is never the owner's words (audit SA-06). A
// suggestion the owner continues is routed by the owner, but its words stay the agent's, and the thread they reach
// gains no structural authority from them. A Ritual now receives nothing at all (CHG-0616): its conversation is its
// run history, has no composer, and refuses owner messages and continued suggestions alike.

const archiveScriptOf = (missionId: MissionId) =>
  `Archive Old notes.\ncall act_on_mission ${JSON.stringify({ action: "Archive", mission: missionId })}`;

/** A resting quest named "Old notes", for the archive script to name. */
const restingQuest = Effect.gen(function* () {
  const quest = yield* start("Hello");
  yield* settle(quest.missionId, isIdle);
  yield* call({ _tag: "RenameMission", missionId: quest.missionId, title: "Old notes" });
  return quest;
});

const createRitual = Effect.suspend(() =>
  call({
    _tag: "CreateRitual",
    fallbacks: [],
    instruction: "Hello",
    primary: { accountId: null, effort: "default", harness: "claude", model: "claude-sonnet-5-5" },
    requestId: crypto.randomUUID(),
    schedule: { _tag: "Daily", time: "07:00" },
    title: "Housekeeping",
    workspacePath: null,
  }),
);

/** Has a new quest suggest the text for the target mission; used where the owner's choice then routes it. */
const suggestFor = Effect.fnUntraced(function* (targetMissionId: MissionId, text: string) {
  const suggester = yield* start("Write the report");
  yield* settle(suggester.missionId, isIdle);
  yield* send(
    suggester.threadId,
    `call suggest_mission ${JSON.stringify({ missions: [targetMissionId], text, title: "Tidy up" })}`,
  );
  const offered = yield* settle(suggester.missionId, (detail) =>
    detail.suggestions.some((pending) => pending.outcome === null),
  );
  const suggestion = offered.suggestions.find((pending) => pending.outcome === null);
  if (suggestion === undefined) return yield* Effect.die("No suggestion");
  return suggestion.id;
});

describe("a Ritual's conversation", () => {
  it.live("refuses an owner's message: it is the run history, with no composer", () =>
    withService(
      Effect.gen(function* () {
        const ritual = yield* createRitual;
        const refused = yield* send(ritual.threadId as ThreadId, "Hello again").pipe(Effect.flip);
        expect(refused.kind).toBe("InvalidInput");
        expect(refused.message).toContain("runs' history");
        const detail = yield* read(ritual.missionId);
        expect(detail.messages).toEqual([]);
        expect(detail.thread.state).toBe("Resting");
      }),
    ),
  );

  it.live("refuses a suggestion the owner continues into it, and nothing is archived", () =>
    withService(
      Effect.gen(function* () {
        const ritual = yield* createRitual;
        const quest = yield* restingQuest;
        const suggestionId = yield* suggestFor(ritual.missionId, archiveScriptOf(quest.missionId));
        const continued = yield* call({
          _tag: "AnswerSuggestion",
          answer: { _tag: "Continue", missionId: ritual.missionId },
          suggestionId,
        }).pipe(Effect.flip);
        expect(continued.kind).toBe("InvalidInput");
        expect(continued.message).toContain("runs' history");
        const detail = yield* read(ritual.missionId);
        expect(detail.messages).toEqual([]);
        expect(detail.threads).toHaveLength(1);
        expect((yield* read(quest.missionId)).mission.state).not.toBe("Archived");
      }),
    ),
  );

  it.live("refuses to open an errand beneath the Ritual by hand: its runs are the errands", () =>
    withService(
      Effect.gen(function* () {
        const ritual = yield* createRitual;
        const refused = yield* call({
          _tag: "OpenThread",
          effort: "default",
          model: "default",
          parentThreadId: ritual.threadId as ThreadId,
          requestId: crypto.randomUUID(),
          shouldStartAnyway: false,
          text: "A hand-opened errand",
        }).pipe(Effect.flip);
        expect(refused.kind).toBe("InvalidInput");
        expect(refused.message).toContain("its runs are the errands");
        expect((yield* read(ritual.missionId)).threads).toHaveLength(1);
      }),
    ),
  );
});

describe("keeping agent-written words from authorizing a structural action", () => {
  it.live("lets a suggestion the owner continues into a quest run its text, which gains it no authority", () =>
    withService(
      Effect.gen(function* () {
        const target = yield* restingQuest;
        const receiver = yield* start("Housekeeping");
        yield* settle(receiver.missionId, isIdle);
        const suggestionId = yield* suggestFor(receiver.missionId, archiveScriptOf(target.missionId));
        yield* call({
          _tag: "AnswerSuggestion",
          answer: { _tag: "Continue", missionId: receiver.missionId },
          suggestionId,
        });
        const done = yield* settle(receiver.missionId, isIdle);
        // The routed text ran as the quest's turn, and its act_on_mission call was refused: agent words authorize
        // nothing. The owner's own words reaching a thread that may act is covered with Chronicler
        // (guildmasterStructuralActions) and inside a Ritual's runs (rituals.test).
        const replies = done.messages.filter((message) => message.sender === "agent").map((message) => message.text);
        expect(replies.some((text) => text.includes("Only Chronicler acts on quests"))).toBe(true);
        expect((yield* read(target.missionId)).mission.state).not.toBe("Archived");
      }),
    ),
  );
});
