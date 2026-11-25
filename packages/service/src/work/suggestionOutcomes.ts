import type { Suggestion, SuggestionOutcome } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { recordResolvedCard } from "./guildmasterCards.ts";
import { insertMission } from "./missions.ts";
import { placeQuestOrigin } from "./questOrigins.ts";
import { proposeTitle, titleOf } from "./titles.ts";

// Where an off-topic request goes (thread-tree): the quests the owner's choice, or the setting, opens for it.

/** Where an off-topic request went, as the suggesting thread is told and its conversation links to. */
export type Resolution = {
  readonly outcome: SuggestionOutcome;
  readonly targetMissionId: string | null;
  readonly targetThreadId: string | null;
  readonly targetTitle: string | null;
};

/** A resolution with the threads its new home wakes. */
export type ResolutionWithWakes = Resolution & { threadsToWake: ReadonlyArray<string> };

/** The resolution of a suggestion whose turn ended before the owner chose. */
export const withdrawn: Resolution = {
  outcome: "Withdrawn",
  targetMissionId: null,
  targetThreadId: null,
  targetTitle: null,
};

/** Opens a mission with only the off-topic part, under the proposed title, with no workspace unless the owner chose a realm. */
export const openMission = Effect.fnUntraced(function* (
  text: string,
  title: string,
  choice: Parameters<typeof insertMission>[1],
  realmPath: string | null = null,
  isFromGuildmaster = false,
  realmId?: string | null,
) {
  const sql = yield* SqlClient.SqlClient;
  const started = yield* insertMission(text, choice, realmPath, false, null, [], realmId);
  // Chronicler hears of this quest's result, Attention, and failure from now on (hearing back).
  if (isFromGuildmaster) yield* sql`UPDATE missions SET opened_by_guildmaster = 1 WHERE id = ${started.missionId}`;
  if (titleOf(title) !== "") yield* proposeTitle(started.missionId, title);
  const [mission] = yield* sql<{ title: string }>`SELECT title FROM missions WHERE id = ${started.missionId}`;
  return {
    outcome: "MovedToMission",
    targetMissionId: started.missionId,
    targetThreadId: started.threadId,
    targetTitle: mission?.title ?? title,
    threadsToWake: started.threadsToWake,
  } satisfies ResolutionWithWakes;
});

/** With the setting on and nothing matching, the new mission opens without asking. */
export const openWithoutAsking = Effect.fnUntraced(function* (threadId: string, text: string, title: string) {
  const sql = yield* SqlClient.SqlClient;
  const resolution = yield* sql.withTransaction(
    Effect.gen(function* () {
      const [thread] = yield* sql<Pick<Suggestion, "model" | "effort" | "harness" | "accountId">>`
          SELECT model, effort, harness, account_id AS accountId FROM threads WHERE id = ${threadId}`;
      const opened = yield* openMission(text, title, {
        accountId: thread?.accountId ?? null,
        effort: thread?.effort ?? "default",
        harness: thread?.harness ?? null,
        model: thread?.model ?? "default",
      });
      yield* recordResolvedCard({
        callerId: threadId,
        isRitual: false,
        realmPath: null,
        target: { missionId: opened.targetMissionId, threadId: opened.targetThreadId, title: opened.targetTitle },
        text,
        title,
      });
      return opened;
    }),
  );
  return resolution;
});

/** Opens a quest directly from a realm or Borderlands channel, anchored to the owner's latest message with no second bubble. */
export const openFromChannel = Effect.fnUntraced(function* (
  threadId: string,
  text: string,
  title: string,
  realmId: string | null,
) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql.withTransaction(
    Effect.gen(function* () {
      const [channel] = yield* sql<
        Pick<Suggestion, "model" | "effort" | "harness" | "accountId"> & {
          backups: string;
          permissionMode: string | null;
        }
      >`SELECT model, effort, harness, account_id AS accountId, backups, permission_mode AS permissionMode
          FROM threads WHERE id = ${threadId}`;
      const opened = yield* openMission(
        text,
        title,
        {
          accountId: channel?.accountId ?? null,
          effort: channel?.effort ?? "default",
          harness: channel?.harness ?? null,
          model: channel?.model ?? "default",
        },
        null,
        false,
        realmId,
      );
      if (channel !== undefined) {
        yield* sql`UPDATE threads SET backups = ${channel.backups}, permission_mode = ${channel.permissionMode}
            WHERE id = ${opened.targetThreadId}`;
      }
      const [latestOwner] = yield* sql<{ id: string }>`
        SELECT id FROM messages WHERE thread_id = ${threadId} AND sender_kind = 'user'
        ORDER BY sequence DESC LIMIT 1`;
      if (latestOwner !== undefined) {
        yield* sql`UPDATE threads SET anchor_message_id = ${latestOwner.id} WHERE id = ${opened.targetThreadId}`;
        yield* placeQuestOrigin(opened.targetThreadId);
      }
      return opened;
    }),
  );
});
