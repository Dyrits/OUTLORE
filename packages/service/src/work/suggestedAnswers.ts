import type { SuggestionOutcome } from "@outlore/contracts";
import { Match } from "effect";
import { type ToolAnswer, toolRefusal, toolText } from "../core/index.ts";
import type { Resolution } from "./suggestionOutcomes.ts";
import type { Suggested } from "./suggestions.ts";

// What `suggest_mission` tells the thread that asked (thread-tree).

/** The sentence that ends every answer: the thread goes on as if the off-topic message had not been sent. */
export const carryOn = "Carry on as if that message had not been sent to you; do not answer it.";
// Chronicler answers its owner instead: one sentence saying where the request went.
/** The sentence Chronicler's answer ends with instead of the carry-on one. */
export const confirmInstead = "Tell the owner in one sentence where it went; do not repeat the request.";

/** What `suggest_mission` tells the thread for each way the owner resolved its suggestion. */
const resolutionTextOf = (resolution: Resolution) =>
  ({
    Continued: `The owner continued it in mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    KeptAsAside: `The owner kept it as an aside beneath you: thread "${resolution.targetTitle}" (id ${resolution.targetThreadId}). It will message you what is relevant to the mission. ${carryOn}`,
    MovedToMission: `The owner opened it as a new mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}). ${carryOn}`,
    Withdrawn: "Withdrawn: the turn that asked ended before the owner answered.",
  }) satisfies Record<SuggestionOutcome, string>;

/** What `suggest_mission` answers the thread. */
export const suggestedAnswerOf = (suggested: Suggested): ToolAnswer =>
  Match.valueTags(suggested, {
    NotAsked: () => toolRefusal("Not asked: this thread is not at work in a turn, so the owner was not asked."),
    OpenedWithoutAsking: ({ resolution }) =>
      toolText(
        `No mission fits, so Outlore opened it as a new mission "${resolution.targetTitle}" (id ${resolution.targetMissionId}), as the owner's settings ask. ${carryOn}`,
      ),
    Resolved: ({ resolution }) =>
      resolution.outcome === "Withdrawn"
        ? toolRefusal(resolutionTextOf(resolution)[resolution.outcome])
        : toolText(resolutionTextOf(resolution)[resolution.outcome]),
    UnknownRealm: ({ given }) =>
      toolRefusal(
        `Not proposed: no realm "${given}" is tied to a folder. Name one of the realms in your context that has a folder, or leave the realm out.`,
      ),
    UnknownThread: () => toolRefusal("Unknown thread."),
  });
