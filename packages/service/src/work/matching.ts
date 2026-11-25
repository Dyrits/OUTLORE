import type { MissionSummary } from "@outlore/contracts";
import { Clock, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { dayMillis, readSettings, wordsOf } from "../core/index.ts";
import { listMissionSummaries } from "./missionSummaries.ts";

/** The dashboard summaries of the missions, by mission id; a mission that no longer stands has none. */
export const readMissionSummaryMap = Effect.fnUntraced(function* (ids: ReadonlyArray<string>) {
  return new Map<string, MissionSummary>((yield* listMissionSummaries(ids)).map((summary) => [summary.id, summary]));
});

/** The text of a quest's first message from the owner, as a column: what the quest was opened to do. `m` is the quest's row. */
export const openingRequestOf = (sql: SqlClient.SqlClient) =>
  sql`(SELECT x.text FROM messages x WHERE x.thread_id = m.top_thread_id AND x.sender_kind = 'user'
    ORDER BY x.sequence LIMIT 1)`;

/** At most this many missions are offered for an off-topic request (thread-tree, Off-topic requests). */
export const maxMatches = 3;

// A ticket key (ABC-123) or a link names one thing exactly, so two requests that share one are about the same work.
const linkPattern = /https?:\/\/[^\s<>"')\]]+/g;
// Keys are written in capitals, as trackers do; a key inside a link counts too, so "ABC-123" meets a quest that holds the ticket's link.
const keyPattern = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

/** The ticket keys and links in a text, lowercased, with a link's final punctuation and trailing slash dropped. */
export const identifiersOf = (text: string) =>
  new Set([
    ...(text.match(linkPattern) ?? []).map((link) => link.toLowerCase().replace(/[.,;:!?/]+$/, "")),
    ...(text.match(keyPattern) ?? []).map((key) => key.toLowerCase()),
  ]);

/** What an exact shared ticket key or link adds to a quest's score: more than any few shared words. */
const identifierScore = 20;

/**
 * Other missions whose titles, briefings, or opening requests share words with the request, best first, at most 3:
 * a title word counts twice, a briefing or opening word once (provisional, work-in-progress Batch 10), and a shared
 * ticket key or link counts 20.
 * Every ordinary mission not deleted counts, whatever its state; Ritual quests, the caller's own mission and Chronicler's do not.
 * A Fulfilled or Archived mission counts only for `endedQuestMatchDays` (14 by default) after it ended, by its finish time or, when it has none, its last activity.
 */
export const findMissions = Effect.fnUntraced(function* (callerId: string, request: string) {
  const sql = yield* SqlClient.SqlClient;
  const staleBefore = (yield* Clock.currentTimeMillis) - (yield* readSettings).endedQuestMatchDays * dayMillis;
  const wanted = wordsOf(request);
  const wantedKeys = identifiersOf(request);
  const rows = yield* sql<{
    id: string;
    title: string;
    briefing: string | null;
    lastActivityAt: number;
    opening: string | null;
  }>`
      SELECT m.id, m.title, j.briefing, m.last_activity_at AS lastActivityAt, ${openingRequestOf(sql)} AS opening
      FROM missions m JOIN threads top ON top.id = m.top_thread_id LEFT JOIN journals j ON j.mission_id = m.id
      WHERE top.is_deleting = 0 AND m.is_guildmaster = 0
        AND NOT EXISTS (SELECT 1 FROM rituals r WHERE r.mission_id = m.id)
        AND (m.ending IS NULL OR COALESCE(m.done_at, m.last_activity_at) >= ${staleBefore})
        AND m.id <> (SELECT mission_id FROM threads WHERE id = ${callerId})`;
  const scored = rows
    .map((row) => {
      const title = wordsOf(row.title);
      const briefing = wordsOf(`${row.briefing ?? ""} ${row.opening ?? ""}`);
      let score = 0;
      for (const word of wanted) score += (title.has(word) ? 2 : 0) + (briefing.has(word) ? 1 : 0);
      const keys = identifiersOf(`${row.title} ${row.briefing ?? ""} ${row.opening ?? ""}`);
      for (const key of wantedKeys) if (keys.has(key)) score += identifierScore;
      return { ...row, score };
    })
    .filter((row) => row.score > 0)
    .sort((current, next) => next.score - current.score || next.lastActivityAt - current.lastActivityAt)
    .slice(0, maxMatches);
  const summaries = yield* readMissionSummaryMap(scored.map((row) => row.id));
  return scored.map((row) => ({
    briefing: row.briefing ?? "",
    id: row.id,
    state: summaries.get(row.id)?.state ?? "Resting",
    title: row.title,
  }));
});

/** `find_missions`'s answer: the matches with their ids, states, and briefings, or that none fits. */
export const findMissionsTextOf = (
  matches: ReadonlyArray<{ id: string; title: string; state: string; briefing: string }>,
) =>
  matches.length === 0
    ? "No mission fits this request."
    : [
        "Missions that may fit, best first:",
        ...matches.map(
          (match, index) =>
            `${index + 1}. "${match.title}" (id ${match.id}) · ${match.state}\n   Briefing: ${match.briefing.trim() === "" ? "(empty)" : match.briefing.trim()}`,
        ),
      ].join("\n");
