import type { Suggestion, SuggestionAnswer } from "@outlore/contracts";
import { Effect, Match } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound } from "../core/index.ts";
import { setCardBackups } from "./backups.ts";
import { insertSuggestedMessage } from "./messageProvenance.ts";
import { openMission, type ResolutionWithWakes } from "./suggestionOutcomes.ts";
import { openAside } from "./tree.ts";

// Carrying out the owner's answer to an off-topic suggestion (thread-tree): continue in a quest, keep as an aside, or open a new quest.

/** Carries out the owner's choice in the answer's transaction; the request's new home is then woken. */
export const carryOut = (suggestion: Suggestion, given: SuggestionAnswer) =>
  Match.valueTags(given, {
    Aside: Effect.fnUntraced(function* () {
      const sql = yield* SqlClient.SqlClient;
      if (suggestion.isFromGuildmaster)
        return yield* invalid("Chronicler keeps no asides: continue in a quest or open a new one.");
      const { value: opened, followUps } = yield* openAside(suggestion.threadId, suggestion.text, suggestion.title);
      const [row] = yield* sql<{ title: string }>`SELECT title FROM threads WHERE id = ${opened.threadId}`;
      return {
        outcome: "KeptAsAside",
        targetMissionId: null,
        targetThreadId: opened.threadId,
        targetTitle: row?.title ?? suggestion.title,
        threadsToWake: followUps.threadsToWake,
      } satisfies ResolutionWithWakes;
    }),
    Continue: Effect.fnUntraced(function* ({ missionId }) {
      const sql = yield* SqlClient.SqlClient;
      if (!suggestion.matches.some((match) => match.missionId === missionId))
        return yield* invalid("That mission was not offered for this message.");
      const [mission] = yield* sql<{ title: string; topThreadId: string }>`
          SELECT title, top_thread_id AS topThreadId FROM missions WHERE id = ${missionId}`;
      if (mission === undefined) return yield* notFound("No such mission.");
      const threadsToWake = yield* insertSuggestedMessage(mission.topThreadId, suggestion.text, true);
      return {
        outcome: "Continued",
        targetMissionId: missionId,
        targetThreadId: mission.topThreadId,
        targetTitle: mission.title,
        threadsToWake,
      } satisfies ResolutionWithWakes;
    }),
    NewMission: Effect.fnUntraced(function* (chosen) {
      const sql = yield* SqlClient.SqlClient;
      // The realm the owner chose on the card (null for the Borderlands) over the one proposed.
      const [source] = yield* sql<{ channel: string | null; realmId: string | null }>`
        SELECT m.chronicler_channel AS channel, t.workspace_id AS realmId
        FROM threads t JOIN missions m ON m.id = t.mission_id WHERE t.id = ${suggestion.threadId}`;
      const isChannel = source?.channel != null;
      const realmId =
        chosen.realmId !== undefined
          ? chosen.realmId
          : chosen.realmPath === undefined && isChannel
            ? source.realmId
            : undefined;
      const chosenPath =
        realmId !== undefined ? null : chosen.realmPath === undefined ? suggestion.realmPath : chosen.realmPath;
      if (chosenPath !== null && (yield* sql`SELECT id FROM workspaces WHERE path = ${chosenPath}`).length === 0)
        return yield* invalid("No realm is tied to that folder.");
      // Left out, the harness and account are the suggesting thread's, as Open as new mission prefills them.
      return yield* openMission(
        suggestion.text,
        suggestion.title,
        {
          accountId:
            chosen.harness === undefined && chosen.accountId === undefined ? suggestion.accountId : chosen.accountId,
          effort: chosen.effort,
          harness: chosen.harness ?? suggestion.harness,
          model: chosen.model,
        },
        chosenPath,
        suggestion.isFromGuildmaster && !isChannel,
        realmId,
      ).pipe(Effect.tap((opened) => setCardBackups(opened.targetThreadId, chosen.backups)));
    }),
  });
