import type { Suggestion, SuggestionAnswer } from "@outlore/contracts";
import { Clock, Context, Effect, Layer } from "effect";
import { SqlClient, type SqlError } from "effect/sql";
import { Changes, invalid, notFound, readSettings, type ServiceFailure, toolText } from "../core/index.ts";
import { makeOwnerWaits } from "./attention.ts";
import { changed, unchanged, type WithFollowUps } from "./followUps.ts";
import { readOptionalRealm } from "./guildmasterPlace.ts";
import { resumeInTurn } from "./lifecycle.ts";
import { findMissions, findMissionsTextOf, maxMatches } from "./matching.ts";
import { insertErrandReply } from "./messaging.ts";
import { placeQuestOrigin } from "./questOrigins.ts";
import { isQuestKindOf, isVisibleQuestOf } from "./questVisibility.ts";
import { carryOut } from "./suggestionAnswers.ts";
import { openFromChannel, openWithoutAsking, type Resolution, withdrawn } from "./suggestionOutcomes.ts";
import { readSuggestion } from "./suggestionStore.ts";
import type { ArgumentsOf, ToolHandlers } from "./threadTools.ts";

/** What a thread's off-topic suggestion came to; what the thread is told is the tool's concern. */
export type Suggested =
  | { readonly _tag: "UnknownThread" }
  /** Chronicler named a realm that no folder is tied to: no card is made (the owner would see the Borderlands). */
  | { readonly _tag: "UnknownRealm"; readonly given: string }
  /** The thread is not at work in a turn, so the owner was not asked. */
  | { readonly _tag: "NotAsked" }
  /** With the setting on and nothing matching, a new mission opened without asking. */
  | { readonly _tag: "OpenedWithoutAsking"; readonly resolution: Resolution }
  | { readonly _tag: "Resolved"; readonly resolution: Resolution };

/** Owns off-topic suggestions: asking the owner, carrying out the choice, and withdrawal (thread-tree). */
export class Suggestions extends Context.Service<
  Suggestions,
  {
    /**
     * Carries out the owner's answer and commits it; the follow-ups, which wake the request's new home, are
     * the caller's to apply (commands.ts), since the waiting turn is settled after the commit.
     */
    readonly answer: (
      suggestionId: string,
      given: SuggestionAnswer,
    ) => Effect.Effect<WithFollowUps<Suggestion>, ServiceFailure | SqlError.SqlError>;
    readonly findMissions: ToolHandlers["find_missions"];
    /**
     * Carries out `suggest_mission` and commits it, asking the owner when needed; the follow-ups, which wake
     * a mission opened without asking, are the caller's to apply.
     */
    readonly suggest: (
      threadId: string,
      args: ArgumentsOf<"suggest_mission">,
    ) => Effect.Effect<WithFollowUps<Suggested>>;
    readonly withdraw: (threadId: string) => Effect.Effect<void>;
  }
>()("outlore/Suggestions") {}

/** Owns off-topic suggestions; a restart withdraws those left open. */
export const suggestionsLayer = Layer.effect(
  Suggestions,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const changes = yield* Changes;
    const waits = makeOwnerWaits<Resolution>(sql, changes);

    // Provisional until recovery is settled (work-in-progress, Open questions: recovery of interrupted turns),
    // as for questions: a restart ends the turn that was waiting.
    const startedAt = yield* Clock.currentTimeMillis;
    yield* sql`UPDATE suggestions SET outcome = 'Withdrawn', resolved_at = ${startedAt} WHERE outcome IS NULL`;

    /** Records the resolution and returns the thread to Underway once nothing else waits on the owner. */
    const resolve = Effect.fnUntraced(function* (suggestionId: string, threadId: string, resolution: Resolution) {
      const now = yield* Clock.currentTimeMillis;
      yield* sql`UPDATE suggestions SET outcome = ${resolution.outcome}, target_mission_id = ${resolution.targetMissionId},
            target_thread_id = ${resolution.targetThreadId}, target_title = ${resolution.targetTitle}, resolved_at = ${now}
          WHERE id = ${suggestionId} AND outcome IS NULL`;
      yield* resumeInTurn(threadId).pipe(Effect.provideService(SqlClient.SqlClient, sql));
    });

    /**
     * Withdraws a suggestion whose turn ended. Threads withdraws while cancelling a turn, beneath the command
     * runner, so this announces its own change.
     */
    const withdrawOne = (suggestionId: string, threadId: string) =>
      sql.withTransaction(
        resolve(suggestionId, threadId, withdrawn).pipe(Effect.tap(() => sql.afterCommit(changes.publish))),
      );

    const answer = Effect.fnUntraced(
      function* (suggestionId: string, given: SuggestionAnswer) {
        const suggestion = yield* readSuggestion(suggestionId);
        if (suggestion === null) return yield* notFound("No such suggestion.");
        if (suggestion.outcome !== null) return yield* invalid("This suggestion was already answered.");
        if (!waits.isWaiting(suggestionId)) return yield* invalid("This suggestion is no longer waiting.");
        const resolution = yield* sql.withTransaction(
          Effect.gen(function* () {
            const done = yield* carryOut(suggestion, given);
            if (suggestion.isFromGuildmaster && given._tag === "NewMission" && done.targetThreadId !== null) {
              const [row] = yield* sql<{
                proposal: string | null;
                channel: string | null;
              }>`SELECT s.proposal_message_id AS proposal, m.chronicler_channel AS channel FROM suggestions s
                  JOIN missions m ON m.id = s.mission_id WHERE s.id = ${suggestionId}`;
              if (row?.proposal != null) {
                yield* sql`UPDATE threads SET anchor_message_id = ${row.proposal} WHERE id = ${done.targetThreadId}`;
                if (row.channel !== null) yield* placeQuestOrigin(done.targetThreadId);
              } else if (row?.channel != null) {
                const [latestOwner] = yield* sql<{ id: string }>`
                  SELECT id FROM messages WHERE thread_id = ${suggestion.threadId} AND sender_kind = 'user'
                  ORDER BY sequence DESC LIMIT 1`;
                if (latestOwner !== undefined) {
                  yield* sql`UPDATE threads SET anchor_message_id = ${latestOwner.id} WHERE id = ${done.targetThreadId}`;
                  yield* placeQuestOrigin(done.targetThreadId);
                }
              }
            }
            yield* resolve(suggestionId, suggestion.threadId, done);
            return done;
          }),
        );
        const { threadsToWake, ...answer } = resolution;
        yield* waits.settle(suggestionId, answer);
        const answered = (yield* readSuggestion(suggestionId)) ?? suggestion;
        return changed(answered, { threadsToWake });
      },
      Effect.provideService(SqlClient.SqlClient, sql),
    );

    /**
     * Opens the suggestion, puts the thread in Attention, and waits with no time limit for the owner; null
     * when the thread is not at work in a turn, so nobody is asked.
     */
    const ask = (
      threadId: string,
      missionId: string,
      text: string,
      title: string,
      matches: ReadonlyArray<string>,
      realmPath: string | null,
      tier: string | null,
      isGuildmaster: boolean,
    ) =>
      waits.ask({
        // A caller that gave up leaves nobody to carry on: the suggestion is withdrawn.
        abandon: (id) => withdrawOne(id, threadId),
        missionId,
        record: (id, now) =>
          Effect.gen(function* () {
            const proposal = isGuildmaster ? yield* insertErrandReply(threadId, text, null).pipe(Effect.orDie) : null;
            yield* sql`INSERT INTO suggestions (id, mission_id, thread_id, text, title, matches, asked_at, realm_path, tier, proposal_message_id)
              VALUES (${id}, ${missionId}, ${threadId}, ${text}, ${title}, ${JSON.stringify(matches)}, ${now}, ${realmPath}, ${tier}, ${proposal})`;
          }),
        threadId,
      });

    const suggest = Effect.fnUntraced(
      function* (threadId: string, args: ArgumentsOf<"suggest_mission">) {
        const { missions = [], title } = args;
        // The thread wrote this text, and it is later stored as the owner's own words: an `@` mention in it must not
        // grant reach as the owner's would (audit SA-06), so the `@` of a reference token is dropped.
        const text = args.text.replace(/@(?=(?:quest|errand|realm):)/g, "");
        const [caller] = yield* sql<{
          channel: string | null;
          isGuildmaster: number;
          missionId: string;
          realmId: string | null;
        }>`SELECT t.mission_id AS missionId, ${isQuestKindOf(sql, "chronicler")} AS isGuildmaster, m.chronicler_channel AS channel,
              t.workspace_id AS realmId
            FROM threads t JOIN missions m ON m.id = t.mission_id WHERE t.id = ${threadId}`;
        if (caller === undefined) return unchanged<Suggested>({ _tag: "UnknownThread" });
        // Chronicler's own quest is never a place to continue (find_missions leaves it out too).
        const existing = new Set(
          (missions.length === 0
            ? []
            : yield* sql<{ id: string }>`SELECT m.id FROM missions m JOIN threads top ON top.id = m.top_thread_id
                WHERE m.id IN ${sql.in([...missions])} AND ${isVisibleQuestOf(sql)}`
          ).map((row) => row.id),
        );
        const named = [...new Set(missions)]
          .filter((id) => existing.has(id) && id !== caller.missionId)
          .slice(0, maxMatches);
        const isGuildmaster = caller.isGuildmaster === 1;
        const isChannel = isGuildmaster && caller.channel !== null;
        const { isNamed, realm } =
          isGuildmaster && !isChannel
            ? yield* readOptionalRealm(args.realm)
            : ({ isNamed: false, realm: null } as const);
        if (isNamed && realm === null)
          return unchanged<Suggested>({ _tag: "UnknownRealm", given: args.realm?.trim() ?? "" });
        if (isChannel && named.length === 0) {
          // A realm or Borderlands channel opens a quest directly under the owner's message with the channel's Companion.
          const channelOpened = yield* openFromChannel(threadId, text, title, caller.realmId).pipe(
            Effect.catch(() => Effect.succeed(null)),
          );
          if (channelOpened !== null) {
            const { threadsToWake, ...resolution } = channelOpened;
            return changed<Suggested>({ _tag: "OpenedWithoutAsking", resolution }, { threadsToWake });
          }
        }
        const shouldOpenOffTopicMissions = !isGuildmaster && (yield* readSettings).shouldOpenOffTopicMissions;
        // Opening without asking needs no mission to match, so it is checked here, not taken from the thread.
        const matches =
          shouldOpenOffTopicMissions && named.length === 0
            ? (yield* findMissions(threadId, text)).map((match) => match.id)
            : named;
        // A mission that cannot open, such as at a reached global budget, is left to the owner's choice.
        const opened =
          shouldOpenOffTopicMissions && matches.length === 0
            ? yield* openWithoutAsking(threadId, text, title).pipe(Effect.catch(() => Effect.succeed(null)))
            : null;
        if (opened !== null) {
          const { threadsToWake, ...resolution } = opened;
          return changed<Suggested>({ _tag: "OpenedWithoutAsking", resolution }, { threadsToWake });
        }
        const resolution = yield* ask(
          threadId,
          caller.missionId,
          text,
          title,
          matches,
          realm?.path ?? null,
          isGuildmaster && !isChannel ? (args.tier ?? null) : null,
          isGuildmaster && !isChannel,
        );
        return unchanged<Suggested>(resolution === null ? { _tag: "NotAsked" } : { _tag: "Resolved", resolution });
      },
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.orDie,
    );

    const findMissionsAnswer = Effect.fnUntraced(
      function* (threadId: string, args: ArgumentsOf<"find_missions">) {
        return toolText(findMissionsTextOf(yield* findMissions(threadId, args.request)));
      },
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.orDie,
    );

    const withdraw = Effect.fnUntraced(function* (threadId: string) {
      const open = yield* sql<{
        id: string;
      }>`SELECT id FROM suggestions WHERE thread_id = ${threadId} AND outcome IS NULL`;
      for (const { id } of open) {
        yield* withdrawOne(id, threadId);
        yield* waits.settle(id, withdrawn);
      }
    }, Effect.orDie);

    return { answer, findMissions: findMissionsAnswer, suggest, withdraw };
  }),
);
