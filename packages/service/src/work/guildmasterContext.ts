import type { Viewing } from "@outlore/contracts";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { readSettings } from "../core/index.ts";
import { isGuildmasterThread } from "./guildmasterPlace.ts";
import { timeOf } from "./journal.ts";
import { openingRequestOf, readMissionSummaryMap } from "./matching.ts";

/** How many quests Chronicler's dashboard text lists at most; the latest ones. */
const maxListedQuests = 60;

/**
 * The line Chronicler reads with a message, saying where the owner had Chronicler open from: the quest when the screen is one
 * (named from the stored title, not the app's), else the screen's name. Null for a message to any other thread.
 */
export const readViewingLine = Effect.fnUntraced(function* (threadId: string, viewing: Viewing | null | undefined) {
  if (viewing === null || viewing === undefined || !(yield* isGuildmasterThread(threadId))) return null;
  const sql = yield* SqlClient.SqlClient;
  const [quest] =
    viewing.missionId === null || viewing.missionId === undefined
      ? []
      : yield* sql<{ id: string; title: string }>`
            SELECT id, title FROM missions WHERE id = ${viewing.missionId} AND is_guildmaster = 0`;
  // The screen's name is the app's words: kept to one plain line, so it cannot pose as an instruction.
  const screen = viewing.screen
    .replace(/[[\]"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return quest === undefined
    ? screen === ""
      ? null
      : `the ${screen} screen`
    : `the quest "${quest.title}" (id ${quest.id})`;
});

/** The realms known, one line each, so Chronicler can name one when it proposes a quest or manages a realm. */
const readRealmLines = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // A quest is placed by its realm's folder, so a realm tied to no folder cannot hold a proposed quest yet (CHG-0161,
  // decision record 0015); it is listed for the realm tools, and marked.
  const realms = yield* sql<{ name: string; path: string | null }>`
    SELECT name, path FROM workspaces WHERE archived_at IS NULL ORDER BY name`;
  return realms.length === 0
    ? ["No realm exists yet; a quest opens with no realm."]
    : realms.map((realm) =>
        realm.path === null
          ? `- ${realm.name}: tied to no folder (a quest cannot be proposed in it from here yet)`
          : `- ${realm.name}: ${realm.path}`,
      );
});

const firstSentenceOf = (text: string) => {
  const flat = text.replace(/\s+/g, " ").trim();
  const end = flat.search(/[.!?](\s|$)/);
  return (end === -1 ? flat : flat.slice(0, end + 1)).slice(0, 240);
};

/**
 * What Chronicler's turn starts from besides its instructions: the realms, and the dashboard as text, one line
 * per quest that is not archived (quest coordination, Context). Built from stored data; Chronicler never keeps it.
 */
export const readGuildmasterContext = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql<{
    briefing: string | null;
    id: string;
    lastActivityAt: number;
    opening: string | null;
    realm: string | null;
    title: string;
    total: number;
  }>`
    SELECT m.id, m.title, m.last_activity_at AS lastActivityAt, j.briefing, w.name AS realm, COUNT(*) OVER () AS total,
      ${openingRequestOf(sql)} AS opening
    FROM missions m
      JOIN threads top ON top.id = m.top_thread_id
      LEFT JOIN journals j ON j.mission_id = m.id
      LEFT JOIN workspaces w ON w.id = top.workspace_id
    WHERE m.is_guildmaster = 0 AND top.is_deleting = 0 AND (m.ending IS NULL OR m.ending = 'Done')
      AND NOT EXISTS (SELECT 1 FROM rituals r WHERE r.mission_id = m.id)
    ORDER BY m.last_activity_at DESC LIMIT ${maxListedQuests}`;
  // The state is the one the dashboard shows: Done once ended, else the most urgent state among the quest's threads.
  const summaries = yield* readMissionSummaryMap(rows.map((row) => row.id));
  const lines = rows.map((row) => {
    const about = firstSentenceOf(row.briefing?.trim() ? row.briefing : (row.opening ?? ""));
    const when = timeOf(row.lastActivityAt);
    return `- "${row.title}" (id ${row.id}) · ${summaries.get(row.id)?.state ?? "Idle"} · ${row.realm ?? "no realm"} · last active ${when} UTC${about === "" ? "" : ` · ${about}`}`;
  });
  const omitted = Math.max(0, (rows[0]?.total ?? 0) - rows.length);
  const { tiers } = yield* readSettings;
  const setTierLines = (["Light", "Balanced", "Heavy"] as const).flatMap((name) => {
    const tier = tiers[name];
    return tier === null ? [] : [`- ${name}: ${tier.harness}, model ${tier.model}, effort ${tier.effort}`];
  });
  const tierLines =
    setTierLines.length === 0 ? ["None set: every quest starts on the owner's default Companion."] : setTierLines;
  const rituals = yield* sql<{ isOn: number; schedule: string; title: string }>`
    SELECT m.title, r.schedule, r.is_on AS isOn FROM rituals r JOIN missions m ON m.id = r.mission_id
    WHERE m.ending IS NULL OR m.ending = 'Done' ORDER BY m.title`;
  return [
    "# Realms",
    ...(yield* readRealmLines),
    "",
    "# Tiers (pass tier to suggest_mission or create_ritual by how demanding the work is)",
    ...tierLines,
    "",
    "# Rituals (instructions that run by themselves on a schedule; create one with create_ritual)",
    ...(rituals.length === 0
      ? ["No Ritual yet."]
      : rituals.map((ritual) => `- "${ritual.title}" · ${ritual.isOn === 1 ? "on" : "off"} · ${ritual.schedule}`)),
    "",
    "# Quests, latest first (this is the dashboard; look deeper with find_missions)",
    ...(lines.length === 0 ? ["No quest yet."] : lines),
    ...(omitted === 0 ? [] : [`${omitted} older quest${omitted === 1 ? "" : "s"} not listed.`]),
  ].join("\n");
});
