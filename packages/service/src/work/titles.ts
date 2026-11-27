import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { invalid, notFound, toolRefusal, toolText } from "../core/index.ts";
import { refuseGuildmaster } from "./guildmasterPlace.ts";
import type { ToolHandlers } from "./threadTools.ts";

/** The title of a quest until its top thread names it. */
export const newQuestTitle = "Quest";

/** The title of an errand until it names itself. */
export const newErrandTitle = "Errand";

/**
 * Asks a thread still called "Quest" or "Errand" to name itself. It rides on the turn's note, not the system part, so
 * naming the thread restarts nothing, and a thread that missed it on its first turn is asked again on the next.
 */
export const namingLineOf = (subject: {
  readonly isGuildmaster: boolean;
  readonly isTitleByUser: boolean;
  readonly position: { readonly isAside: boolean; readonly parent: unknown; readonly title: string };
}) => {
  const { parent, title } = subject.position;
  if (subject.isGuildmaster || subject.position.isAside) return null;
  if (parent === null && !subject.isTitleByUser && title === newQuestTitle)
    return `It is still "${newQuestTitle}": call set_mission_title now with a short title of a few words for this quest.`;
  if (parent !== null && title === newErrandTitle)
    return `It is still "${newErrandTitle}": call set_mission_title now with a short title of a few words for this errand.`;
  return null;
};

/** A title from a text: its first line, trimmed, at most 200 characters. */
export const titleOf = (text: string) => text.trim().split("\n", 1)[0]?.trim().slice(0, 200) ?? "";

/** The most characters a Ritual's title keeps when Chronicler creates it. */
const maxRitualTitleLength = 80;

/** A Ritual's title from the title Chronicler gave: a title, cut shorter. */
export const ritualTitleOf = (text: string) => titleOf(text).slice(0, maxRitualTitleLength);

/** Sets the mission's title and its top thread's, which follows it. Callers run it in a transaction. */
const writeTitle = Effect.fnUntraced(function* (missionId: string, title: string, isByUser: boolean) {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`UPDATE missions SET title = ${title}, is_title_by_user = ${isByUser ? 1 : sql`is_title_by_user`}
      WHERE id = ${missionId}`;
  yield* sql`UPDATE threads SET title = ${title} WHERE id = (SELECT top_thread_id FROM missions WHERE id = ${missionId})`;
});

/** Names a mission with a thread's proposed title, which the top thread may still change. Callers run it in a transaction. */
export const proposeTitle = (missionId: string, title: string) => writeTitle(missionId, titleOf(title), false);

/** The owner renames a mission; `set_mission_title` is refused from then on (mission-tracking, Title). */
export const renameMission = Effect.fn("renameMission")(function* (missionId: string, title: string) {
  const sql = yield* SqlClient.SqlClient;
  const cleaned = titleOf(title);
  if (cleaned === "") return yield* invalid("The title is empty.");
  const [mission] = yield* sql<{ id: string }>`SELECT id FROM missions WHERE id = ${missionId}`;
  if (mission === undefined) return yield* notFound("No such mission.");
  yield* refuseGuildmaster(missionId, "renamed");
  yield* writeTitle(missionId, cleaned, true);
  return null;
});

/** Answers `set_mission_title`; `commit` runs a change in one transaction and announces it. */
export const titleToolsOf = (
  commit: <A, E>(work: Effect.Effect<A, E, SqlClient.SqlClient>) => Effect.Effect<A>,
): Pick<ToolHandlers, "set_mission_title"> => ({
  set_mission_title: (threadId, args) => {
    const title = titleOf(args.title);
    if (title === "") return Effect.succeed(toolRefusal("Not named: give a title."));
    return commit(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const [mission] = yield* sql<{ id: string; isTitleByUser: number }>`
          SELECT id, is_title_by_user AS isTitleByUser FROM missions WHERE top_thread_id = ${threadId}`;
        if (mission === undefined) {
          // An errand names itself: its own title, which nothing else follows.
          const renamed = yield* sql`UPDATE threads SET title = ${title} WHERE id = ${threadId} RETURNING id`;
          return renamed.length === 0
            ? toolRefusal("Not named: no such thread.")
            : toolText(`Named the errand "${title}".`);
        }
        if (mission.isTitleByUser === 1)
          return toolRefusal("Not named: the owner named this mission, so its title stays.");
        yield* writeTitle(mission.id, title, false);
        return toolText(`Named the mission "${title}".`);
      }),
    );
  },
});
