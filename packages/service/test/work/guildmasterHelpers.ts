import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { MissionDetail, MissionId, Suggestion, SuggestionAnswer, ThreadId } from "@outlore/contracts";
import { Effect } from "effect";
import { isIdle, say } from "../fixtures/guildmaster.ts";
import { call, settle } from "../fixtures/service.ts";

/** Answers a card the owner is holding. */
export const answer = (suggestion: Suggestion, given: SuggestionAnswer) =>
  call({ _tag: "AnswerSuggestion", answer: given, suggestionId: suggestion.id });

/** Chronicler proposes a quest by a card, which waits for the owner's choice; returns the card. */
export const proposeCard = (place: { missionId: MissionId; threadId: ThreadId }, args: object) =>
  Effect.gen(function* () {
    yield* say(place.threadId, `call suggest_mission ${JSON.stringify(args)}`);
    const waiting = yield* settle(
      place.missionId,
      (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === null),
      place.threadId,
    );
    const card = waiting.suggestions.find((suggestion) => suggestion.outcome === null);
    if (card === undefined) return yield* Effect.die("Missing card");
    return card;
  });

/** The quest a resolved card opened. */
export const questOf = (card: Suggestion | undefined) =>
  Effect.gen(function* () {
    if (card?.targetMissionId == null) return yield* Effect.die("The card opened no quest");
    return card.targetMissionId;
  });

/** Chronicler proposes a quest, and the owner opens it as a new quest; returns the quest. */
export const openByOwner = (place: { missionId: MissionId; threadId: ThreadId }, args: object) =>
  Effect.gen(function* () {
    const card = yield* proposeCard(place, args);
    yield* answer(card, { _tag: "NewMission", effort: "default", model: "default" });
    const done = yield* settle(
      place.missionId,
      (detail) => detail.suggestions.some((suggestion) => suggestion.outcome === "MovedToMission") && isIdle(detail),
      place.threadId,
    );
    return yield* questOf(done.suggestions.find((suggestion) => suggestion.outcome === "MovedToMission"));
  });

/** A folder under the fixture's home, which a quest turns into a realm. */
export const folderIn = (directory: string, name: string) => {
  const path = join(realpathSync(directory), name);
  mkdirSync(path, { recursive: true });
  return path;
};

/** The `call act_on_mission` line an owner's message can carry to name an archive. */
export const archiveQuest = (missionId: MissionId) =>
  `call act_on_mission ${JSON.stringify({ action: "Archive", mission: missionId })}`;

/** The questions of a detail still waiting for the owner. */
export const openQuestions = (detail: MissionDetail) =>
  detail.questions.filter((question) => question.outcome === null);

/** Waits until Chronicler is idle or asks; returns its detail. */
export const waitUntilAsked = (place: { missionId: MissionId; threadId: ThreadId }) =>
  settle(place.missionId, (detail) => isIdle(detail) || openQuestions(detail).length > 0, place.threadId);
